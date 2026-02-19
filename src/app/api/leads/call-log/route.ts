import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CallOutcome } from '@prisma/client';
import { logLeadAction } from '@/lib/prospection/lead-audit';

// POST /api/leads/call-log
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { leadId, outcome, duration, notes, questionsAsked, nextCallDate, rdvDate } = await request.json();

        if (!leadId || !outcome) {
            return NextResponse.json({ error: 'Lead ID and Outcome required' }, { status: 400 });
        }

        // 1. Create Call Log
        const log = await prisma.callLog.create({
            data: {
                leadId,
                callerId: session.user.id,
                outcome: outcome as CallOutcome,
                duration,
                notes,
                questionsAsked,
                nextCallDate: nextCallDate ? new Date(nextCallDate) : null,
            },
        });

        // 2. Update Lead Status & Next Action
        const updateData: any = {};

        if (nextCallDate) {
            updateData.nextCallDate = new Date(nextCallDate);
        }

        // Status automation based on outcome
        if (outcome === 'A_RAPPELER') {
            updateData.status = 'A_RAPPELER';
        } else if (outcome === 'NRP') {
            updateData.status = 'NE_REPONDS_PAS';
        } else if (outcome === 'PAS_INTERESSE') {
            updateData.status = 'PAS_INTERESSE';
            updateData.lostReason = 'Qualifié non-intéressé par téléphone';
        } else if (outcome === 'INTERESSE') {
            // Keep current status or move to something positive if needed
            // For now, we don't auto-change status for Interested unless specifically requested
            // But usually Interested -> remains in pipeline to be converted or moves to another step
        }

        // RDV Specific Update
        if (rdvDate) {
            updateData.dateRdv = new Date(rdvDate);
            updateData.status = 'RDV_PLANIFIE';
        }

        if (rdvDate) {
            updateData.dateRdv = new Date(rdvDate);
            updateData.status = 'RDV_PLANIFIE';
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.lead.update({
                where: { id: leadId },
                data: updateData,
            });

            // Log Audit for RDV
            if (rdvDate && session.user.organizationId) {
                await logLeadAction(
                    leadId,
                    session.user.organizationId,
                    session.user.id,
                    'ADMIN',
                    'UPDATE',
                    `RDV Planifié le ${new Date(rdvDate).toLocaleString('fr-FR')}`,
                    { newState: { status: 'RDV_PLANIFIE', dateRdv: rdvDate } }
                );
            }
        }

        return NextResponse.json(log);
    } catch (error) {
        console.error('Call Log Error:', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
