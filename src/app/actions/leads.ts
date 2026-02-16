'use server';

import { prisma } from '@/lib/prisma';
import { LeadStatus, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// --- Schemas ---

const DispatchLeadSchema = z.object({
    leadId: z.string(),
    siteId: z.string(),
});

const RegisterInteractionSchema = z.object({
    leadId: z.string(),
    type: z.enum(['CALL_NO_ANSWER', 'CALL_INTERESTED', 'CALL_NOT_INTERESTED', 'BOOK_RDV']),
    details: z.object({
        notes: z.string().optional(),
        dateRdv: z.string().datetime().optional(), // Required if BOOK_RDV
    }),
});

// --- Actions ---

export async function getLeads(organizationId: string, filters?: {
    siteId?: string,
    status?: LeadStatus,
    search?: string
}) {
    const where: Prisma.LeadWhereInput = {
        organizationId,
        ...(filters?.siteId && { siteId: filters.siteId }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.search && {
            OR: [
                { nom: { contains: filters.search, mode: 'insensitive' } },
                { prenom: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } },
            ]
        })
    };

    const leads = await prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            site: true,
            campaign: true
        }
    });

    return { success: true, data: leads };
}

export async function dispatchLead(data: z.infer<typeof DispatchLeadSchema>) {
    const result = DispatchLeadSchema.safeParse(data);
    if (!result.success) {
        return { success: false, error: result.error.message };
    }

    const { leadId, siteId } = result.data;

    try {
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                siteId,
                status: LeadStatus.DISPATCHED
            }
        });

        revalidatePath('/prospection');
        return { success: true };
    } catch (error) {
        console.error('Error dispatching lead:', error);
        return { success: false, error: 'Failed to dispatch lead' };
    }
}

export async function registerInteraction(data: z.infer<typeof RegisterInteractionSchema>) {
    const result = RegisterInteractionSchema.safeParse(data);
    if (!result.success) {
        return { success: false, error: result.error.message };
    }

    const { leadId, type, details } = result.data;
    let newStatus: LeadStatus = LeadStatus.ATTEMPTED;
    let updateData: Prisma.LeadUpdateInput = {};

    // Logique de transition d'état
    switch (type) {
        case 'CALL_NO_ANSWER':
            newStatus = LeadStatus.ATTEMPTED;
            break;
        case 'CALL_INTERESTED':
            newStatus = LeadStatus.QUALIFIED; // Ou NURTURING
            break;
        case 'CALL_NOT_INTERESTED':
            newStatus = LeadStatus.NOT_ELIGIBLE;
            break;
        case 'BOOK_RDV':
            if (!details.dateRdv) return { success: false, error: 'Date RDV required' };
            newStatus = LeadStatus.RDV_SCHEDULED;
            updateData.dateRdv = new Date(details.dateRdv);
            break;
    }

    try {
        // 1. Récupérer le lead actuel pour concaténer les notes
        const currentLead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { notes: true },
        });

        // Construire les notes concaténées (timestamp + type + nouvelles notes)
        const typeLabels: Record<string, string> = {
            'CALL_NO_ANSWER': '📞 Pas de réponse',
            'CALL_INTERESTED': '🤔 Intéressé',
            'CALL_NOT_INTERESTED': '❌ Pas intéressé',
            'BOOK_RDV': '📅 RDV réservé',
        };
        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const newEntry = `[${timestamp}] ${typeLabels[type] || type}${details.notes ? ' — ' + details.notes : ''}`;
        const concatenatedNotes = currentLead?.notes
            ? newEntry + '\n' + currentLead.notes
            : newEntry;

        // 2. Mise à jour du Lead
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: newStatus,
                notes: concatenatedNotes,
                ...updateData
            }
        });

        revalidatePath('/prospection');
        return { success: true };
    } catch (error) {
        console.error('Error registering interaction:', error);
        return { success: false, error: 'Failed to register interaction' };
    }
}
