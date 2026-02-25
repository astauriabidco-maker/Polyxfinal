'use server';

import { prisma } from '@/lib/prisma';
import { LeadStatus, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { notifyLeadInteraction, notifyLeadQualified, notifyLeadConverted } from '@/lib/messaging/notification-hooks';
import { refreshLeadScore } from '@/lib/prospection/lead-scoring';

// --- Constantes Pipeline / CRM (local, not exported — 'use server' only exports async functions) ---

const PIPELINE_STATUSES: LeadStatus[] = [
    LeadStatus.NEW,
    LeadStatus.DISPATCHED,
    LeadStatus.A_RAPPELER,
    LeadStatus.NE_REPONDS_PAS,
    LeadStatus.PAS_INTERESSE,
];

const CRM_STATUSES: LeadStatus[] = [
    LeadStatus.RDV_PLANIFIE,
    LeadStatus.RDV_NON_HONORE,
    LeadStatus.RDV_ANNULE,
    LeadStatus.DECISION_EN_ATTENTE,
    LeadStatus.TEST_EN_COURS_PERSO,
    LeadStatus.EN_ATTENTE_PAIEMENT,
    LeadStatus.INSCRIT_PERSO,
    LeadStatus.CPF_COMPTE_A_DEMANDER,
    LeadStatus.COURRIERS_ENVOYES,
    LeadStatus.COURRIERS_RECUS,
    LeadStatus.NEGOCIATION,
    LeadStatus.CONVERTI,
    LeadStatus.PROBLEMES_SAV,
    LeadStatus.PERDU,
];

// --- Schemas ---



const RegisterInteractionSchema = z.object({
    leadId: z.string(),
    type: z.enum(['CALL_NO_ANSWER', 'CALL_INTERESTED', 'CALL_NOT_INTERESTED', 'BOOK_RDV']),
    details: z.object({
        notes: z.string().optional(),
        dateRdv: z.string().datetime().optional(),
        nextCallDate: z.string().datetime().optional(),
    }),
});

const ReassignLeadSchema = z.object({
    leadId: z.string(),
    assignedToId: z.string(),
});

const UpdateCRMStatusSchema = z.object({
    leadId: z.string(),
    status: z.enum([
        'RDV_PLANIFIE', 'RDV_NON_HONORE', 'RDV_ANNULE', 'DECISION_EN_ATTENTE',
        'TEST_EN_COURS_PERSO', 'EN_ATTENTE_PAIEMENT', 'INSCRIT_PERSO', 'CPF_COMPTE_A_DEMANDER',
        'COURRIERS_ENVOYES', 'COURRIERS_RECUS', 'NEGOCIATION', 'CONVERTI',
        'PROBLEMES_SAV', 'PERDU'
    ]),
    lostReason: z.string().optional(),
});

// --- Actions ---

export async function getLeads(organizationId: string, filters?: {
    siteId?: string,
    status?: LeadStatus,
    search?: string,
    module?: 'pipeline' | 'crm',
}) {
    const where: Prisma.LeadWhereInput = {
        organizationId,
        ...(filters?.siteId && { siteId: filters.siteId }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.module === 'pipeline' && { status: { in: PIPELINE_STATUSES } }),
        ...(filters?.module === 'crm' && { status: { in: CRM_STATUSES } }),
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
            campaign: true,
            assignedTo: { select: { id: true, nom: true, prenom: true } },
        }
    });

    return { success: true, data: leads };
}



/**
 * Auto-dispatch par code postal via la table Territory
 */
export async function autoDispatchByZipCode(leadId: string, zipCode: string, organizationId: string) {
    try {
        // Chercher un territoire dont les zipCodes contiennent le CP du lead
        const territory = await prisma.territory.findFirst({
            where: {
                isActive: true,
                zipCodes: { has: zipCode },
                organization: {
                    OR: [
                        { id: organizationId },
                        { parentId: organizationId },
                    ],
                    isActive: true,
                },
            },
            include: {
                organization: {
                    select: {
                        id: true,
                        sites: {
                            where: { isActive: true },
                            orderBy: { isHeadquarters: 'desc' as const },
                            take: 1,
                            select: { id: true },
                        },
                    },
                },
            },
        });

        if (territory && territory.organization.sites.length > 0) {
            const targetSiteId = territory.organization.sites[0].id;
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    siteId: targetSiteId,
                    status: LeadStatus.DISPATCHED,
                },
            });
            return { success: true, dispatched: true, siteId: targetSiteId, territoryName: territory.name };
        }

        return { success: true, dispatched: false };
    } catch (error) {
        console.error('Error auto-dispatching lead:', error);
        return { success: false, error: 'Auto-dispatch failed' };
    }
}

/**
 * Enregistrer une interaction Pipeline (call, rdv, etc.)
 * ⚠️ BOOK_RDV est bloqué si le lead n'a pas de consentement RGPD
 */
export async function registerInteraction(data: z.infer<typeof RegisterInteractionSchema>) {
    const result = RegisterInteractionSchema.safeParse(data);
    if (!result.success) {
        return { success: false, error: result.error.message };
    }

    const { leadId, type, details } = result.data;
    let newStatus: LeadStatus = LeadStatus.A_RAPPELER;
    let updateData: Prisma.LeadUpdateInput = {};

    switch (type) {
        case 'CALL_NO_ANSWER':
            newStatus = LeadStatus.NE_REPONDS_PAS;
            break;
        case 'CALL_INTERESTED':
            newStatus = LeadStatus.A_RAPPELER;
            if (details.nextCallDate) {
                updateData.nextCallDate = new Date(details.nextCallDate);
            }
            break;
        case 'CALL_NOT_INTERESTED':
            newStatus = LeadStatus.PAS_INTERESSE;
            break;
        case 'BOOK_RDV':
            if (!details.dateRdv) return { success: false, error: 'Date RDV required' };

            // ⚠️ RGPD Guard: Vérifier le consentement avant de planifier un RDV
            const consent = await prisma.leadConsent.findUnique({
                where: { leadId },
                select: { consentGiven: true, withdrawnAt: true, anonymizedAt: true },
            });
            if (!consent || !consent.consentGiven || consent.withdrawnAt || consent.anonymizedAt) {
                return {
                    success: false,
                    error: 'CONSENT_REQUIRED',
                    message: '⚠️ Consentement RGPD requis avant de planifier un RDV. Recueillez le consentement du prospect d\'abord.',
                };
            }

            newStatus = LeadStatus.RDV_PLANIFIE; // Bascule vers CRM
            updateData.dateRdv = new Date(details.dateRdv);
            break;
    }

    try {
        const currentLead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { notes: true },
        });

        const typeLabels: Record<string, string> = {
            'CALL_NO_ANSWER': '📞 Pas de réponse',
            'CALL_INTERESTED': '🤔 Intéressé — A rappeler',
            'CALL_NOT_INTERESTED': '❌ Pas intéressé',
            'BOOK_RDV': '📅 RDV fixé',
        };
        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const newEntry = `[${timestamp}] ${typeLabels[type] || type}${details.notes ? ' — ' + details.notes : ''}`;
        const concatenatedNotes = currentLead?.notes
            ? newEntry + '\n' + currentLead.notes
            : newEntry;

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: newStatus,
                notes: concatenatedNotes,
                ...updateData
            }
        });

        revalidatePath('/prospection');
        revalidatePath('/crm');

        // Hook WhatsApp: Interaction enregistrée (async, non-blocking)
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { id: true, nom: true, prenom: true, telephone: true, email: true, organizationId: true },
        });
        if (lead) {
            notifyLeadInteraction(lead.organizationId, lead, type)
                .catch(err => console.error('[Hook] Lead interaction notification failed:', err));
            // If booking RDV, also fire LEAD_QUALIFIED
            if (type === 'BOOK_RDV') {
                notifyLeadQualified(lead.organizationId, { ...lead, formationSouhaitee: null }, 'RDV_PLANIFIE')
                    .catch(err => console.error('[Hook] Lead qualified notification failed:', err));
            }
        }

        // Dynamic score refresh (async)
        refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

        return { success: true };
    } catch (error) {
        console.error('Error registering interaction:', error);
        return { success: false, error: 'Failed to register interaction' };
    }
}

/**
 * Recueillir / Enregistrer le consentement RGPD d'un lead
 */
export async function recordConsent(leadId: string, consentGiven: boolean = true) {
    try {
        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

        await prisma.leadConsent.upsert({
            where: { leadId },
            update: {
                consentGiven,
                consentText: consentGiven
                    ? `Consentement recueilli manuellement le ${timestamp}`
                    : `Consentement refusé le ${timestamp}`,
                consentMethod: 'manual_update',
                legalBasis: consentGiven ? 'consent' : 'legitimate_interest',
                withdrawnAt: consentGiven ? null : new Date(),
            },
            create: {
                leadId,
                consentGiven,
                consentText: consentGiven
                    ? `Consentement recueilli manuellement le ${timestamp}`
                    : `Saisie sans consentement le ${timestamp}`,
                consentMethod: 'manual_update',
                legalBasis: consentGiven ? 'consent' : 'legitimate_interest',
            },
        });

        // Add note to lead
        const currentLead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { notes: true },
        });
        const newEntry = `[${timestamp}] 🛡️ ${consentGiven ? 'Consentement RGPD recueilli' : 'Consentement RGPD refusé'}`;
        const concatenatedNotes = currentLead?.notes
            ? newEntry + '\n' + currentLead.notes
            : newEntry;

        await prisma.lead.update({
            where: { id: leadId },
            data: { notes: concatenatedNotes },
        });

        // Dynamic score refresh (consent affects score)
        refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

        revalidatePath('/prospection');
        revalidatePath('/prospection/leads');
        revalidatePath('/crm');
        return { success: true };
    } catch (error) {
        console.error('Error recording consent:', error);
        return { success: false, error: 'Failed to record consent' };
    }
}

/**
 * Réattribuer un lead à un commercial (resp. agence)
 */
export async function reassignLead(data: z.infer<typeof ReassignLeadSchema>) {
    const result = ReassignLeadSchema.safeParse(data);
    if (!result.success) {
        return { success: false, error: result.error.message };
    }

    try {
        await prisma.lead.update({
            where: { id: result.data.leadId },
            data: { assignedToId: result.data.assignedToId },
        });

        revalidatePath('/prospection');
        revalidatePath('/crm');
        return { success: true };
    } catch (error) {
        console.error('Error reassigning lead:', error);
        return { success: false, error: 'Failed to reassign lead' };
    }
}

/**
 * Changer le statut CRM d'un lead (drag & drop Kanban)
 */
export async function updateCRMStatus(data: z.infer<typeof UpdateCRMStatusSchema>) {
    const result = UpdateCRMStatusSchema.safeParse(data);
    if (!result.success) {
        return { success: false, error: result.error.message };
    }

    const { leadId, status, lostReason } = result.data;
    const updateData: Prisma.LeadUpdateInput = {
        status: status as LeadStatus,
    };

    if (status === 'PERDU' && lostReason) {
        updateData.lostReason = lostReason;
    }

    if (status === 'CONVERTI') {
        updateData.convertedAt = new Date();
    }

    try {
        const currentLead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { notes: true },
        });

        const timestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const newEntry = `[${timestamp}] 📋 Statut CRM → ${status}${lostReason ? ' — ' + lostReason : ''}`;
        const concatenatedNotes = currentLead?.notes
            ? newEntry + '\n' + currentLead.notes
            : newEntry;

        updateData.notes = concatenatedNotes;

        await prisma.lead.update({
            where: { id: leadId },
            data: updateData,
        });

        revalidatePath('/crm');

        // Hook WhatsApp: CRM status change (async, non-blocking)
        const leadData = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { id: true, nom: true, prenom: true, telephone: true, email: true, organizationId: true, formationSouhaitee: true },
        });
        if (leadData) {
            if (status === 'CONVERTI') {
                notifyLeadConverted(leadData.organizationId, leadData)
                    .catch(err => console.error('[Hook] Lead converted notification failed:', err));
            } else if (['RDV_PLANIFIE', 'NEGOCIATION'].includes(status)) {
                notifyLeadQualified(leadData.organizationId, leadData, status)
                    .catch(err => console.error('[Hook] Lead qualified notification failed:', err));
            }
        }

        // Dynamic score refresh (async)
        refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

        return { success: true };
    } catch (error) {
        console.error('Error updating CRM status:', error);
        return { success: false, error: 'Failed to update status' };
    }
}

/**
 * Changer le statut Pipeline d'un lead (drag & drop Kanban)
 */
export async function updatePipelineStatus(leadId: string, status: LeadStatus) {
    if (!PIPELINE_STATUSES.includes(status)) {
        return { success: false, error: 'Invalid pipeline status' };
    }

    try {
        await prisma.lead.update({
            where: { id: leadId },
            data: { status },
        });

        // Dynamic score refresh (async)
        refreshLeadScore(leadId).catch(err => console.error('[Scoring] Refresh failed:', err));

        revalidatePath('/prospection');
        return { success: true };
    } catch (error) {
        console.error('Error updating pipeline status:', error);
        return { success: false, error: 'Failed to update status' };
    }
}
