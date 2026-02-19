/**
 * CRON — Process Message Queue & Advance Sequences
 * ==================================================
 * POST /api/messaging/cron
 * Called periodically (every 1-5 minutes) to:
 * - Process PENDING scheduled messages
 * - Advance sequence enrollments
 * - Check stop-on-reply conditions
 */

import { NextRequest, NextResponse } from 'next/server';
import { processScheduledMessages, advanceSequences, checkStopConditions } from '@/lib/messaging/scheduler.service';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
    // Verify cron secret (if set)
    if (CRON_SECRET) {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        // 1. Check stop conditions first (so we don't send to people who replied)
        const stopped = await checkStopConditions();

        // 2. Advance active sequences (creates scheduled messages)
        const sequencesAdvanced = await advanceSequences();

        // 3. Process the message queue
        const queueStats = await processScheduledMessages();

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            stats: {
                ...queueStats,
                sequencesAdvanced,
                sequencesStopped: stopped,
            },
        });
    } catch (error) {
        console.error('Erreur POST /api/messaging/cron:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
