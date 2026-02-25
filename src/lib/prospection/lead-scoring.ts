/**
 * LEAD SCORING ENGINE — Score universel + dynamique
 * ====================================================
 * Attribue un score de 0 à 100 à CHAQUE lead (toutes sources).
 * 
 * Architecture en 2 couches :
 *   1. Score de base (complétude + qualité des données)  → 0-70 pts
 *   2. Score dynamique (interactions + comportement)      → -15 à +30 pts
 * 
 * Score final = clamp(base + dynamique, 0, 100)
 *
 * Barème :
 *   A (80-100) 🟢  → Lead haute qualité, prioritaire
 *   B (60-79)  🟡  → Lead correct, exploitable
 *   C (40-59)  🟠  → Lead moyen, à qualifier
 *   D (0-39)   🔴  → Lead faible, attention
 */

import { prisma } from '@/lib/prisma';

// ─── Types ────────────────────────────────────────────────────

export interface LeadScoreResult {
    score: number;           // 0–100
    grade: 'A' | 'B' | 'C' | 'D';
    breakdown: ScoreBreakdown[];
}

export interface ScoreBreakdown {
    criterion: string;
    maxPoints: number;
    earnedPoints: number;
    reason: string;
}

// ─── Configuration ───────────────────────────────────────────

const DISPOSABLE_EMAIL_DOMAINS = [
    'yopmail.com', 'mailinator.com', 'guerrillamail.com', 'tempmail.com',
    'throwaway.email', 'sharklasers.com', 'trashmail.com', 'temp-mail.org',
    'fakeinbox.com', 'dispostable.com', 'maildrop.cc', '10minutemail.com',
];

const SOURCE_QUALITY: Record<string, number> = {
    'PARTNER_API': 10,
    'GOOGLE_ADS': 9,
    'FACEBOOK_ADS': 8,
    'LINKEDIN_ADS': 8,
    'TIKTOK_ADS': 7,
    'WEBSITE_FORM': 9,
    'REFERRAL': 10,
    'EVENT': 7,
    'MANUAL': 5,
    'OTHER': 4,
};

// ─── 1. SCORE UNIVERSEL (toutes sources) ─────────────────────

/**
 * Calcule le score universel d'un lead, quel que soit sa source.
 * Fonctionne avec les données disponibles (pas de champs obligatoires).
 */
export async function calculateUniversalScore(leadData: {
    id?: string;
    email: string;
    telephone?: string | null;
    adresse?: string | null;
    codePostal?: string | null;
    ville?: string | null;
    formationSouhaitee?: string | null;
    source?: string | null;
    organizationId: string;
    // Données optionnelles enrichies (mode partenaire)
    consentText?: string | null;
    sourceUrl?: string | null;
    dateReponse?: string | null;
}): Promise<LeadScoreResult> {

    const breakdown: ScoreBreakdown[] = [];

    // ────────────────────────────────────────────────────────────
    // 1. Email valide + professionnel (15 pts)
    // ────────────────────────────────────────────────────────────
    const emailDomain = leadData.email.split('@')[1]?.toLowerCase() || '';
    const isDisposable = DISPOSABLE_EMAIL_DOMAINS.some(d => emailDomain.endsWith(d));
    const isGenericFree = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'orange.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'wanadoo.fr'].includes(emailDomain);

    let emailPoints = 15;
    let emailReason = 'Email professionnel valide';

    if (isDisposable) {
        emailPoints = 0;
        emailReason = 'Email jetable détecté (domaine blacklisté)';
    } else if (isGenericFree) {
        emailPoints = 8;
        emailReason = 'Email personnel (gratuit/FAI)';
    }

    breakdown.push({ criterion: 'Email', maxPoints: 15, earnedPoints: emailPoints, reason: emailReason });

    // ────────────────────────────────────────────────────────────
    // 2. Téléphone renseigné et valide (10 pts)
    // ────────────────────────────────────────────────────────────
    let phonePoints = 0;
    let phoneReason = 'Téléphone absent';

    if (leadData.telephone) {
        const cleanPhone = leadData.telephone.replace(/[\s\-\.()]/g, '');
        if (cleanPhone.length >= 10) {
            phonePoints = 10;
            phoneReason = 'Téléphone complet et valide';
        } else if (cleanPhone.length >= 6) {
            phonePoints = 5;
            phoneReason = 'Téléphone format court';
        }
    }

    breakdown.push({ criterion: 'Téléphone', maxPoints: 10, earnedPoints: phonePoints, reason: phoneReason });

    // ────────────────────────────────────────────────────────────
    // 3. Adresse complète (10 pts)
    // ────────────────────────────────────────────────────────────
    let adressePoints = 0;
    let adresseReason = 'Adresse non renseignée';

    const hasRue = leadData.adresse && leadData.adresse.length >= 5;
    const hasCp = leadData.codePostal && leadData.codePostal.length === 5;
    const hasVille = leadData.ville && leadData.ville.length >= 2;

    if (hasRue && hasCp && hasVille) {
        adressePoints = 10;
        adresseReason = 'Adresse complète (rue + CP + ville)';
    } else if (hasCp && hasVille) {
        adressePoints = 6;
        adresseReason = 'Code postal et ville présents';
    } else if (hasCp) {
        adressePoints = 3;
        adresseReason = 'Code postal seul';
    }

    breakdown.push({ criterion: 'Adresse', maxPoints: 10, earnedPoints: adressePoints, reason: adresseReason });

    // ────────────────────────────────────────────────────────────
    // 4. Formation identifiée (15 pts)
    // ────────────────────────────────────────────────────────────
    let formationPoints = 0;
    let formationReason = 'Formation non renseignée';

    if (leadData.formationSouhaitee) {
        const len = leadData.formationSouhaitee.trim().length;
        if (len >= 10) {
            formationPoints = 15;
            formationReason = 'Formation précise et détaillée';
        } else if (len >= 3) {
            formationPoints = 8;
            formationReason = 'Formation renseignée mais peu détaillée';
        } else {
            formationPoints = 3;
            formationReason = 'Formation trop vague';
        }
    }

    breakdown.push({ criterion: 'Formation', maxPoints: 15, earnedPoints: formationPoints, reason: formationReason });

    // ────────────────────────────────────────────────────────────
    // 5. Qualité de la source (10 pts)
    // ────────────────────────────────────────────────────────────
    const sourceKey = leadData.source || 'OTHER';
    const sourceScore = SOURCE_QUALITY[sourceKey] || 4;
    const sourcePoints = sourceScore;
    const sourceReason = `Source: ${sourceKey} (qualité ${sourceScore}/10)`;

    breakdown.push({ criterion: 'Source', maxPoints: 10, earnedPoints: sourcePoints, reason: sourceReason });

    // ────────────────────────────────────────────────────────────
    // 6. Pas de doublon email (10 pts)
    // ────────────────────────────────────────────────────────────
    let dupePoints = 10;
    let dupeReason = 'Email unique dans l\'organisation';

    try {
        const existingCount = await prisma.lead.count({
            where: {
                email: leadData.email,
                organizationId: leadData.organizationId,
                ...(leadData.id ? { NOT: { id: leadData.id } } : {}),
            },
        });

        if (existingCount > 0) {
            dupePoints = 0;
            dupeReason = `Doublon : ${existingCount} lead(s) existant(s) avec cet email`;
        }
    } catch {
        dupePoints = 5;
        dupeReason = 'Vérification doublon non disponible';
    }

    breakdown.push({ criterion: 'Unicité', maxPoints: 10, earnedPoints: dupePoints, reason: dupeReason });

    // ────────────────────────────────────────────────────────────
    // TOTAL BASE
    // ────────────────────────────────────────────────────────────
    const baseScore = breakdown.reduce((sum, b) => sum + b.earnedPoints, 0);
    // Max base = 70

    return { score: Math.min(100, Math.max(0, baseScore)), grade: scoreToGrade(baseScore), breakdown };
}

// ─── 2. BONUS DYNAMIQUE (basé sur les interactions) ──────────

/**
 * Calcule les bonus/malus dynamiques basés sur le comportement du lead.
 * Appelé lors de chaque changement de statut.
 */
export async function calculateDynamicBonus(leadId: string): Promise<{
    bonus: number;
    details: ScoreBreakdown[];
}> {
    const details: ScoreBreakdown[] = [];

    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
            status: true,
            createdAt: true,
            dateRdv: true,
            convertedAt: true,
            nextCallDate: true,
            leadConsent: { select: { consentGiven: true, withdrawnAt: true } },
        },
    });

    if (!lead) return { bonus: 0, details };

    // ─── Bonus/Malus par statut ─────────────────────────────
    const STATUS_BONUS: Record<string, number> = {
        'NEW': 0,
        'DISPATCHED': 2,
        'A_RAPPELER': 5,      // Intéressé → bonus
        'NE_REPONDS_PAS': -5, // NRP → malus
        'PAS_INTERESSE': -10, // Pas intéressé → fort malus
        'RDV_PLANIFIE': 15,   // RDV = lead chaud
        'RDV_NON_HONORE': -5, // No-show → malus
        'COURRIERS_ENVOYES': 10, // Devis envoyé
        'COURRIERS_RECUS': 15,   // Documents signés
        'NEGOCIATION': 10,
        'CONVERTI': 20,       // Converti → max bonus
        'PERDU': -15,         // Perdu → fort malus
    };

    const statusBonus = STATUS_BONUS[lead.status] || 0;
    details.push({
        criterion: 'Statut pipeline',
        maxPoints: 20,
        earnedPoints: statusBonus,
        reason: `Statut actuel : ${lead.status} (${statusBonus > 0 ? '+' : ''}${statusBonus})`,
    });

    // ─── Fraîcheur du lead ──────────────────────────────────
    const ageHours = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60);
    let freshnessBonus = 0;
    let freshnessReason = '';

    if (ageHours <= 24) {
        freshnessBonus = 10;
        freshnessReason = 'Lead frais (<24h) — prioritaire';
    } else if (ageHours <= 72) {
        freshnessBonus = 5;
        freshnessReason = 'Lead récent (1-3 jours)';
    } else if (ageHours <= 168) { // 7 days
        freshnessBonus = 0;
        freshnessReason = 'Lead de la semaine';
    } else if (ageHours <= 720) { // 30 days
        freshnessBonus = -5;
        freshnessReason = 'Lead vieillissant (>7j)';
    } else {
        freshnessBonus = -10;
        freshnessReason = 'Lead froid (>30j)';
    }

    details.push({
        criterion: 'Fraîcheur',
        maxPoints: 10,
        earnedPoints: freshnessBonus,
        reason: freshnessReason,
    });

    // ─── Consentement RGPD ──────────────────────────────────
    let consentBonus = 0;
    let consentReason = 'Consentement non vérifié';

    if (lead.leadConsent) {
        if (lead.leadConsent.consentGiven && !lead.leadConsent.withdrawnAt) {
            consentBonus = 5;
            consentReason = 'Consentement RGPD validé';
        } else if (lead.leadConsent.withdrawnAt) {
            consentBonus = -10;
            consentReason = 'Consentement retiré — lead non exploitable';
        } else {
            consentBonus = -5;
            consentReason = 'Consentement non donné — actions limitées';
        }
    } else {
        consentBonus = -5;
        consentReason = 'Aucun enregistrement de consentement';
    }

    details.push({
        criterion: 'Consentement RGPD',
        maxPoints: 5,
        earnedPoints: consentBonus,
        reason: consentReason,
    });

    const totalBonus = details.reduce((sum, b) => sum + b.earnedPoints, 0);
    return { bonus: totalBonus, details };
}

// ─── 3. SCORE COMPLET (base + dynamique) ─────────────────────

/**
 * Calcule le score complet d'un lead (base + dynamique).
 * C'est la fonction à appeler pour un scoring complet.
 */
export async function calculateFullScore(leadId: string): Promise<LeadScoreResult> {
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
            id: true,
            email: true,
            telephone: true,
            adresse: true,
            codePostal: true,
            ville: true,
            formationSouhaitee: true,
            source: true,
            organizationId: true,
        },
    });

    if (!lead) {
        return { score: 0, grade: 'D', breakdown: [] };
    }

    // Score de base
    const baseResult = await calculateUniversalScore({
        id: lead.id,
        email: lead.email,
        telephone: lead.telephone,
        adresse: lead.adresse,
        codePostal: lead.codePostal,
        ville: lead.ville,
        formationSouhaitee: lead.formationSouhaitee,
        source: lead.source,
        organizationId: lead.organizationId,
    });

    // Bonus dynamique
    const dynamicResult = await calculateDynamicBonus(leadId);

    // Fusion
    const allBreakdown = [...baseResult.breakdown, ...dynamicResult.details];
    const totalScore = Math.min(100, Math.max(0, baseResult.score + dynamicResult.bonus));
    const grade = scoreToGrade(totalScore);

    return { score: totalScore, grade, breakdown: allBreakdown };
}

// ─── 4. MISE À JOUR EN BASE ─────────────────────────────────

/**
 * Recalcule et persiste le score d'un lead en base.
 * Appeler cette fonction à chaque événement clé.
 */
export async function refreshLeadScore(leadId: string): Promise<LeadScoreResult> {
    const result = await calculateFullScore(leadId);

    await prisma.lead.update({
        where: { id: leadId },
        data: { score: result.score },
    });

    return result;
}

/**
 * Recalcule les scores de tous les leads d'une organisation.
 * Utile pour batch refresh ou cron job.
 */
export async function refreshAllScores(organizationId: string): Promise<number> {
    const leads = await prisma.lead.findMany({
        where: { organizationId },
        select: { id: true },
    });

    let updated = 0;
    for (const lead of leads) {
        try {
            await refreshLeadScore(lead.id);
            updated++;
        } catch (err) {
            console.error(`[Scoring] Failed to refresh score for lead ${lead.id}:`, err);
        }
    }

    return updated;
}

// ─── 5. BACKWARD COMPAT — Partner API scoring ───────────────

/**
 * Calcul de score enrichi pour les leads partenaires (avec données supplémentaires).
 * Maintenu pour compatibilité avec l'API partenaire existante.
 */
export async function calculateLeadScore(leadData: {
    email: string;
    telephone: string;
    adresse: string;
    codePostal: string;
    ville: string;
    formationSouhaitee: string;
    consentText: string;
    sourceUrl: string;
    dateReponse?: string | null;
    organizationId: string;
}): Promise<LeadScoreResult> {

    // Base universelle
    const baseResult = await calculateUniversalScore({
        ...leadData,
        source: 'PARTNER_API',
    });

    const extraBreakdown: ScoreBreakdown[] = [];

    // ─── Bonus partenaire : Consentement détaillé ───────────
    let consentPoints = 0;
    let consentReason = 'Consentement minimal';
    const consentLen = leadData.consentText.trim().length;
    if (consentLen >= 50) {
        consentPoints = 10;
        consentReason = 'Texte de consentement complet et détaillé';
    } else if (consentLen >= 30) {
        consentPoints = 7;
        consentReason = 'Texte de consentement acceptable';
    } else if (consentLen >= 10) {
        consentPoints = 4;
        consentReason = 'Texte de consentement court';
    }
    extraBreakdown.push({ criterion: 'Consentement (texte)', maxPoints: 10, earnedPoints: consentPoints, reason: consentReason });

    // ─── Bonus partenaire : Source URL ───────────────────────
    let sourceUrlPoints = 0;
    let sourceUrlReason = 'URL source manquante';
    try {
        const url = new URL(leadData.sourceUrl);
        sourceUrlPoints = url.protocol === 'https:' ? 5 : 3;
        sourceUrlReason = url.protocol === 'https:' ? 'URL HTTPS valide' : 'URL HTTP (non sécurisée)';
    } catch {
        sourceUrlPoints = 0;
        sourceUrlReason = 'URL invalide';
    }
    extraBreakdown.push({ criterion: 'Source URL', maxPoints: 5, earnedPoints: sourceUrlPoints, reason: sourceUrlReason });

    // ─── Bonus partenaire : Délai de réponse ────────────────
    let delaiPoints = 0;
    let delaiReason = 'Date de réponse non renseignée';
    if (leadData.dateReponse) {
        try {
            const diffHours = (Date.now() - new Date(leadData.dateReponse).getTime()) / (1000 * 60 * 60);
            if (diffHours <= 24) { delaiPoints = 15; delaiReason = 'Réponse <24h — excellent'; }
            else if (diffHours <= 48) { delaiPoints = 10; delaiReason = 'Réponse <48h — bon'; }
            else if (diffHours <= 72) { delaiPoints = 5; delaiReason = 'Réponse 48-72h — acceptable'; }
            else { delaiPoints = 2; delaiReason = 'Réponse >72h — lead froid'; }
        } catch { delaiReason = 'Date de réponse invalide'; }
    }
    extraBreakdown.push({ criterion: 'Délai réponse', maxPoints: 15, earnedPoints: delaiPoints, reason: delaiReason });

    // Total
    const extraScore = extraBreakdown.reduce((sum, b) => sum + b.earnedPoints, 0);
    const totalScore = Math.min(100, baseResult.score + extraScore);

    return {
        score: totalScore,
        grade: scoreToGrade(totalScore),
        breakdown: [...baseResult.breakdown, ...extraBreakdown],
    };
}

// ─── Helpers ──────────────────────────────────────────────────

export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' {
    if (score >= 80) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    return 'D';
}

export function gradeColor(grade: 'A' | 'B' | 'C' | 'D'): string {
    switch (grade) {
        case 'A': return '#059669';
        case 'B': return '#d97706';
        case 'C': return '#ea580c';
        case 'D': return '#dc2626';
    }
}

export function gradeEmoji(grade: 'A' | 'B' | 'C' | 'D'): string {
    switch (grade) {
        case 'A': return '🟢';
        case 'B': return '🟡';
        case 'C': return '🟠';
        case 'D': return '🔴';
    }
}
