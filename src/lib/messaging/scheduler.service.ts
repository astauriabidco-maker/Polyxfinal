/**
 * SCHEDULER SERVICE — Process Message Queue & Sequences
 * ======================================================
 * Processes pending scheduled messages and advances sequence enrollments.
 * Retry logic with exponential backoff.
 */

import { prisma } from '@/lib/prisma';
import { sendMessage } from './messaging.service';

// Retry delays: 5min, 30min, 2h
const RETRY_DELAYS = [5, 30, 120];

// ─── Process Scheduled Messages ──────────────────────────────

/**
 * Process all PENDING scheduled messages where scheduledAt <= now
 */
export async function processScheduledMessages(): Promise<{
    processed: number;
    sent: number;
    failed: number;
    retried: number;
}> {
    const stats = { processed: 0, sent: 0, failed: 0, retried: 0 };

    try {
        // Find messages ready to send
        const messages = await (prisma as any).scheduledMessage.findMany({
            where: {
                status: { in: ['PENDING'] },
                scheduledAt: { lte: new Date() },
            },
            take: 50, // Process in batches
            orderBy: { scheduledAt: 'asc' },
        });

        for (const msg of messages) {
            stats.processed++;

            // Mark as processing
            await (prisma as any).scheduledMessage.update({
                where: { id: msg.id },
                data: { status: 'PROCESSING' },
            });

            try {
                // Send the message
                const result = await sendMessage(msg.organizationId, {
                    to: msg.phone,
                    text: msg.content,
                    channel: msg.channel === 'SMS' ? 'sms' : 'whatsapp',
                    templateKey: msg.templateKey || undefined,
                    leadId: msg.leadId || undefined,
                    dossierId: msg.dossierId || undefined,
                    sentById: msg.sentById || undefined,
                });

                if (result.success) {
                    await (prisma as any).scheduledMessage.update({
                        where: { id: msg.id },
                        data: {
                            status: 'SENT',
                            messageId: result.dbMessageId || null,
                        },
                    });
                    stats.sent++;
                } else {
                    await handleFailure(msg, result.error || 'Unknown error');
                    if (msg.retryCount < msg.maxRetries) stats.retried++;
                    else stats.failed++;
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Send error';
                await handleFailure(msg, errorMsg);
                if (msg.retryCount < msg.maxRetries) stats.retried++;
                else stats.failed++;
            }
        }
    } catch (err) {
        console.error('[Scheduler] processScheduledMessages error:', err);
    }

    if (stats.processed > 0) {
        console.log(`[Scheduler] Processed: ${stats.processed}, Sent: ${stats.sent}, Failed: ${stats.failed}, Retried: ${stats.retried}`);
    }

    return stats;
}

// ─── Handle Failure with Retry ───────────────────────────────

async function handleFailure(msg: any, error: string) {
    const newRetryCount = msg.retryCount + 1;

    if (newRetryCount >= msg.maxRetries) {
        // Max retries reached — mark as failed
        await (prisma as any).scheduledMessage.update({
            where: { id: msg.id },
            data: {
                status: 'FAILED',
                lastError: error,
                retryCount: newRetryCount,
            },
        });
    } else {
        // Schedule retry with exponential backoff
        const delayMinutes = RETRY_DELAYS[newRetryCount - 1] || 120;
        const nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000);

        await (prisma as any).scheduledMessage.update({
            where: { id: msg.id },
            data: {
                status: 'PENDING',
                lastError: error,
                retryCount: newRetryCount,
                scheduledAt: nextRetry,
            },
        });
    }
}

// ─── Advance Sequence Enrollments ────────────────────────────

/**
 * Process active sequence enrollments where nextStepAt <= now
 */
export async function advanceSequences(): Promise<number> {
    let advanced = 0;

    try {
        const enrollments = await (prisma as any).sequenceEnrollment.findMany({
            where: {
                status: 'ACTIVE',
                nextStepAt: { lte: new Date() },
            },
            take: 50,
            include: {
                sequence: {
                    include: { steps: { orderBy: { stepOrder: 'asc' } } },
                },
            },
        });

        for (const enrollment of enrollments) {
            const nextStepIndex = enrollment.currentStep; // 0-indexed from steps array
            const steps = enrollment.sequence.steps;
            const step = steps[nextStepIndex];

            if (!step) {
                // No more steps — mark as completed
                await (prisma as any).sequenceEnrollment.update({
                    where: { id: enrollment.id },
                    data: { status: 'COMPLETED', stoppedAt: new Date() },
                });
                continue;
            }

            // Create a scheduled message for this step
            await (prisma as any).scheduledMessage.create({
                data: {
                    organizationId: enrollment.organizationId,
                    sequenceEnrollmentId: enrollment.id,
                    phone: enrollment.phone,
                    content: step.content || `[Template: ${step.templateKey}]`,
                    channel: step.channel || 'WHATSAPP',
                    templateKey: step.templateKey || null,
                    scheduledAt: new Date(), // Send now
                    leadId: enrollment.leadId || null,
                    dossierId: enrollment.dossierId || null,
                },
            });

            // Determine next step
            const nextStep = steps[nextStepIndex + 1];
            if (nextStep) {
                const nextStepAt = new Date(enrollment.referenceDate);
                nextStepAt.setDate(nextStepAt.getDate() + nextStep.delayDays);
                if (nextStepAt < new Date()) {
                    nextStepAt.setTime(Date.now() + 60000); // At least 1 min from now
                }

                await (prisma as any).sequenceEnrollment.update({
                    where: { id: enrollment.id },
                    data: {
                        currentStep: nextStepIndex + 1,
                        nextStepAt,
                    },
                });
            } else {
                // Was the last step
                await (prisma as any).sequenceEnrollment.update({
                    where: { id: enrollment.id },
                    data: {
                        currentStep: nextStepIndex + 1,
                        status: 'COMPLETED',
                        stoppedAt: new Date(),
                    },
                });
            }

            advanced++;
        }
    } catch (err) {
        console.error('[Scheduler] advanceSequences error:', err);
    }

    return advanced;
}

// ─── Check Stop-on-Reply Conditions ──────────────────────────

/**
 * Stop sequences where the contact has replied (inbound message exists)
 */
export async function checkStopConditions(): Promise<number> {
    let stopped = 0;

    try {
        const activeEnrollments = await (prisma as any).sequenceEnrollment.findMany({
            where: { status: 'ACTIVE' },
            include: { sequence: { select: { stopOnReply: true } } },
        });

        for (const enrollment of activeEnrollments) {
            if (!enrollment.sequence.stopOnReply) continue;

            // Check for inbound messages from this phone after enrollment start
            const replyCount = await (prisma as any).message.count({
                where: {
                    organizationId: enrollment.organizationId,
                    phone: enrollment.phone,
                    direction: 'INBOUND',
                    createdAt: { gte: enrollment.createdAt },
                },
            });

            if (replyCount > 0) {
                await (prisma as any).sequenceEnrollment.update({
                    where: { id: enrollment.id },
                    data: {
                        status: 'STOPPED_BY_REPLY',
                        stoppedAt: new Date(),
                        stoppedReason: `Contact a répondu (${replyCount} message(s))`,
                    },
                });

                // Cancel any pending scheduled messages for this enrollment
                await (prisma as any).scheduledMessage.updateMany({
                    where: {
                        sequenceEnrollmentId: enrollment.id,
                        status: 'PENDING',
                    },
                    data: { status: 'CANCELLED' },
                });

                stopped++;
            }
        }
    } catch (err) {
        console.error('[Scheduler] checkStopConditions error:', err);
    }

    return stopped;
}
