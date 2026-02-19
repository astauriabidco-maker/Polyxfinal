/**
 * AUTOMATION SERVICE — Event-Triggered Messaging
 * =================================================
 * Processes events from the learning journey and triggers
 * automated messages via ScheduledMessage queue.
 */

import { prisma } from '@/lib/prisma';

// ─── Types ────────────────────────────────────────────────────

export interface AutomationContext {
    phone?: string;
    leadId?: string;
    dossierId?: string;
    sessionId?: string;
    nom?: string;
    prenom?: string;
    email?: string;
    formation?: string;
    dateDebut?: string;
    dateFin?: string;
    lieuFormation?: string;
    [key: string]: string | undefined;
}

// ─── Main Trigger Function ───────────────────────────────────

/**
 * Trigger all automations and sequences for an event
 */
export async function triggerEvent(
    organizationId: string,
    event: string,
    context: AutomationContext
): Promise<{ automationsTriggered: number; sequencesEnrolled: number }> {
    let automationsTriggered = 0;
    let sequencesEnrolled = 0;

    try {
        // 1. Find all active automations for this event
        const automations = await (prisma as any).messageAutomation.findMany({
            where: {
                organizationId,
                event,
                isActive: true,
            },
        });

        for (const automation of automations) {
            const triggered = await processAutomation(automation, context);
            if (triggered) automationsTriggered++;
        }

        // 2. Find all active sequences triggered by this event
        const sequences = await (prisma as any).messageSequence.findMany({
            where: {
                organizationId,
                triggerEvent: event,
                isActive: true,
            },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });

        for (const sequence of sequences) {
            const enrolled = await enrollInSequence(sequence, context, organizationId);
            if (enrolled) sequencesEnrolled++;
        }

        console.log(`[Automation] Event ${event}: ${automationsTriggered} automations, ${sequencesEnrolled} sequences`);
    } catch (err) {
        console.error('[Automation] triggerEvent error:', err);
    }

    return { automationsTriggered, sequencesEnrolled };
}

// ─── Process Single Automation ───────────────────────────────

async function processAutomation(
    automation: any,
    context: AutomationContext
): Promise<boolean> {
    const phone = context.phone;
    if (!phone) {
        console.warn(`[Automation] No phone for automation ${automation.id}`);
        return false;
    }

    // Check conditions if any
    if (automation.conditions) {
        try {
            const conditions = JSON.parse(automation.conditions);
            for (const [key, value] of Object.entries(conditions)) {
                if (context[key] !== value) {
                    return false; // Condition not met
                }
            }
        } catch {
            // Invalid JSON, skip conditions
        }
    }

    // Resolve message content with variables
    const content = resolveVariables(automation.content || '', context);

    // Schedule the message
    const scheduledAt = new Date(Date.now() + (automation.delayMinutes || 0) * 60 * 1000);

    await (prisma as any).scheduledMessage.create({
        data: {
            organizationId: automation.organizationId,
            automationId: automation.id,
            phone: phone.replace(/[\s\-\(\)\+]/g, ''),
            content,
            channel: automation.channel || 'WHATSAPP',
            templateKey: automation.templateKey || null,
            scheduledAt,
            leadId: context.leadId || null,
            dossierId: context.dossierId || null,
        },
    });

    return true;
}

// ─── Enroll in Sequence ──────────────────────────────────────

async function enrollInSequence(
    sequence: any,
    context: AutomationContext,
    organizationId: string
): Promise<boolean> {
    const phone = context.phone;
    if (!phone) return false;

    const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '');

    // Check if already enrolled
    const existing = await (prisma as any).sequenceEnrollment.findFirst({
        where: {
            sequenceId: sequence.id,
            phone: normalizedPhone,
            status: 'ACTIVE',
        },
    });

    if (existing) return false; // Already in this sequence

    // Determine reference date (session start date, or now)
    const referenceDate = context.dateDebut ? new Date(context.dateDebut) : new Date();

    // Find first step
    const firstStep = sequence.steps?.[0];
    if (!firstStep) return false;

    // Calculate next step execution time
    const nextStepAt = new Date(referenceDate);
    nextStepAt.setDate(nextStepAt.getDate() + firstStep.delayDays);
    // If nextStepAt is in the past, set to now + 1 minute
    if (nextStepAt < new Date()) {
        nextStepAt.setTime(Date.now() + 60000);
    }

    await (prisma as any).sequenceEnrollment.create({
        data: {
            sequenceId: sequence.id,
            organizationId,
            phone: normalizedPhone,
            leadId: context.leadId || null,
            dossierId: context.dossierId || null,
            referenceDate,
            nextStepAt,
            currentStep: 0,
        },
    });

    return true;
}

// ─── Variable Resolution ─────────────────────────────────────

function resolveVariables(
    content: string,
    context: AutomationContext
): string {
    let resolved = content;
    for (const [key, value] of Object.entries(context)) {
        if (value !== undefined) {
            resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
            resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
    }
    return resolved;
}
