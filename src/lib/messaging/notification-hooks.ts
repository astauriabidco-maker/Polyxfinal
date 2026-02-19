/**
 * NOTIFICATION HOOKS — Cross-Module WhatsApp Integration
 * ========================================================
 * Central service that bridges other modules (Dossiers, Leads, CRM)
 * to the WhatsApp automation engine.
 *
 * Each hook:
 * 1. Checks if messaging is active for the org
 * 2. Checks if the specific hook is enabled (admin toggle)
 * 3. Fires triggerEvent() asynchronously (non-blocking)
 *
 * All hooks are DISABLED by default — admin must toggle on.
 */

import { prisma } from '@/lib/prisma';
import { triggerEvent, AutomationContext } from './automation.service';

// ─── Hook Names ──────────────────────────────────────────────

export const HOOK_NAMES = {
    DOSSIER_STATUS_CHANGE: 'DOSSIER_STATUS_CHANGE',
    LEAD_CREATED: 'LEAD_CREATED',
    LEAD_QUALIFIED: 'LEAD_QUALIFIED',
    LEAD_INTERACTION: 'LEAD_INTERACTION',
    LEAD_CONVERTED: 'LEAD_CONVERTED',
} as const;

export type HookName = typeof HOOK_NAMES[keyof typeof HOOK_NAMES];

export const HOOK_LABELS: Record<HookName, { label: string; description: string; icon: string }> = {
    DOSSIER_STATUS_CHANGE: {
        label: 'Changement statut dossier',
        description: 'Déclenche un message WhatsApp quand un dossier change de statut (ex: ADMIS, CONTRACTUALISÉ, CLÔTURÉ)',
        icon: '📋',
    },
    LEAD_CREATED: {
        label: 'Nouveau lead créé',
        description: 'Déclenche un message WhatsApp quand un nouveau lead est enregistré dans le système',
        icon: '🆕',
    },
    LEAD_QUALIFIED: {
        label: 'Lead qualifié',
        description: 'Déclenche un message WhatsApp quand un lead passe en RDV_PLANIFIE ou statut qualifié',
        icon: '⭐',
    },
    LEAD_INTERACTION: {
        label: 'Interaction enregistrée',
        description: 'Déclenche un message WhatsApp quand un appel, RDV ou interaction est enregistré',
        icon: '📞',
    },
    LEAD_CONVERTED: {
        label: 'Lead converti',
        description: 'Déclenche un message WhatsApp quand un lead est converti en dossier de formation',
        icon: '🎉',
    },
};

// ─── Core: Check if hook is enabled ──────────────────────────

async function isHookEnabled(organizationId: string, hookName: HookName): Promise<boolean> {
    try {
        const config = await (prisma as any).messagingConfig.findUnique({
            where: { organizationId },
            select: { isActive: true, enabledHooks: true },
        });

        if (!config || !config.isActive) return false;

        const hooks = config.enabledHooks as Record<string, boolean> | null;
        if (!hooks) return false;

        return hooks[hookName] === true;
    } catch (err) {
        console.error(`[NotificationHook] Error checking hook ${hookName}:`, err);
        return false;
    }
}

// ─── Hook: Dossier Status Change ─────────────────────────────

export async function notifyDossierStatusChange(
    organizationId: string,
    dossierId: string,
    oldStatus: string,
    newStatus: string
): Promise<void> {
    if (!(await isHookEnabled(organizationId, 'DOSSIER_STATUS_CHANGE'))) return;

    // Fetch dossier details for template variables
    const dossier = await (prisma as any).dossier.findUnique({
        where: { id: dossierId },
        include: {
            session: {
                include: {
                    programme: { select: { titre: true } },
                },
            },
        },
    });

    if (!dossier?.stagiaireTelephone) return;

    const ctx: AutomationContext = {
        phone: dossier.stagiaireTelephone,
        dossierId,
        sessionId: dossier.session?.id,
        nom: dossier.stagiaireNom,
        prenom: dossier.stagiairePrenom,
        email: dossier.stagiaireEmail || undefined,
        formation: dossier.session?.programme?.titre || '',
        dateDebut: dossier.session?.dateDebut?.toLocaleDateString('fr-FR') || '',
        dateFin: dossier.session?.dateFin?.toLocaleDateString('fr-FR') || '',
        lieuFormation: dossier.session?.lieuFormation || '',
        oldStatus,
        newStatus,
    };

    // Use specific event names for specific transitions
    let eventName = 'DOSSIER_STATUS_CHANGE';
    if (newStatus === 'ADMIS' || newStatus === 'ACTIF') {
        eventName = 'INSCRIPTION_CONFIRMED';
    } else if (newStatus === 'CLOTURE' || newStatus === 'TERMINE') {
        eventName = 'MODULE_COMPLETED';
    }

    // Try specific event first, fall back to generic
    const result = await triggerEvent(organizationId, eventName, ctx);
    if (result.automationsTriggered === 0 && result.sequencesEnrolled === 0 && eventName !== 'DOSSIER_STATUS_CHANGE') {
        await triggerEvent(organizationId, 'DOSSIER_STATUS_CHANGE', ctx);
    }

    console.log(`[Hook] DOSSIER_STATUS_CHANGE: ${dossierId} ${oldStatus}→${newStatus} (event: ${eventName})`);
}

// ─── Hook: Lead Created ──────────────────────────────────────

export async function notifyLeadCreated(
    organizationId: string,
    lead: { id: string; nom: string; prenom: string; telephone?: string | null; email: string; formationSouhaitee?: string | null }
): Promise<void> {
    if (!(await isHookEnabled(organizationId, 'LEAD_CREATED'))) return;
    if (!lead.telephone) return;

    const ctx: AutomationContext = {
        phone: lead.telephone,
        leadId: lead.id,
        nom: lead.nom,
        prenom: lead.prenom,
        email: lead.email,
        formation: lead.formationSouhaitee || '',
    };

    await triggerEvent(organizationId, 'LEAD_CREATED', ctx);
    console.log(`[Hook] LEAD_CREATED: ${lead.id} (${lead.prenom} ${lead.nom})`);
}

// ─── Hook: Lead Qualified ────────────────────────────────────

export async function notifyLeadQualified(
    organizationId: string,
    lead: { id: string; nom: string; prenom: string; telephone?: string | null; email: string; formationSouhaitee?: string | null },
    newStatus: string
): Promise<void> {
    if (!(await isHookEnabled(organizationId, 'LEAD_QUALIFIED'))) return;
    if (!lead.telephone) return;

    const ctx: AutomationContext = {
        phone: lead.telephone,
        leadId: lead.id,
        nom: lead.nom,
        prenom: lead.prenom,
        email: lead.email,
        formation: lead.formationSouhaitee || '',
        newStatus,
    };

    await triggerEvent(organizationId, 'LEAD_QUALIFIED', ctx);
    console.log(`[Hook] LEAD_QUALIFIED: ${lead.id} → ${newStatus}`);
}

// ─── Hook: Lead Interaction ──────────────────────────────────

export async function notifyLeadInteraction(
    organizationId: string,
    lead: { id: string; nom: string; prenom: string; telephone?: string | null; email?: string | null },
    interactionType: string
): Promise<void> {
    if (!(await isHookEnabled(organizationId, 'LEAD_INTERACTION'))) return;
    if (!lead.telephone) return;

    const ctx: AutomationContext = {
        phone: lead.telephone,
        leadId: lead.id,
        nom: lead.nom,
        prenom: lead.prenom,
        email: lead.email || undefined,
        interactionType,
    };

    await triggerEvent(organizationId, 'LEAD_INTERACTION', ctx);
    console.log(`[Hook] LEAD_INTERACTION: ${lead.id} (${interactionType})`);
}

// ─── Hook: Lead Converted ────────────────────────────────────

export async function notifyLeadConverted(
    organizationId: string,
    lead: { id: string; nom: string; prenom: string; telephone?: string | null; email?: string | null; formationSouhaitee?: string | null }
): Promise<void> {
    if (!(await isHookEnabled(organizationId, 'LEAD_CONVERTED'))) return;
    if (!lead.telephone) return;

    const ctx: AutomationContext = {
        phone: lead.telephone,
        leadId: lead.id,
        nom: lead.nom,
        prenom: lead.prenom,
        email: lead.email || undefined,
        formation: lead.formationSouhaitee || '',
    };

    await triggerEvent(organizationId, 'LEAD_CONVERTED', ctx);
    console.log(`[Hook] LEAD_CONVERTED: ${lead.id}`);
}
