/**
 * LEAD SCORING ENGINE — Qualité automatique des leads partenaires
 * ================================================================
 * Attribue un score de 0 à 100 à chaque lead soumis via l'API.
 * Le score est calculé sur 8 critères objectifs et mesurables.
 *
 * Barème :
 *   A (80-100) 🟢  → Lead haute qualité
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

// ─── Configuration scoring ───────────────────────────────────

const DISPOSABLE_EMAIL_DOMAINS = [
    'yopmail.com', 'mailinator.com', 'guerrillamail.com', 'tempmail.com',
    'throwaway.email', 'sharklasers.com', 'trashmail.com', 'temp-mail.org',
    'fakeinbox.com', 'dispostable.com', 'maildrop.cc', '10minutemail.com',
];

// ─── Scoring Function ────────────────────────────────────────

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

    const breakdown: ScoreBreakdown[] = [];

    // ────────────────────────────────────────────────────────────
    // 1. Email valide + professionnel (15 pts)
    // ────────────────────────────────────────────────────────────
    const emailDomain = leadData.email.split('@')[1]?.toLowerCase() || '';
    const isDisposable = DISPOSABLE_EMAIL_DOMAINS.some(d => emailDomain.endsWith(d));
    const isGenericFree = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com'].includes(emailDomain);

    let emailPoints = 15;
    let emailReason = 'Email professionnel valide';

    if (isDisposable) {
        emailPoints = 0;
        emailReason = 'Email jetable détecté (domaine blacklisté)';
    } else if (isGenericFree) {
        emailPoints = 8;
        emailReason = 'Email personnel (gratuit) — moins fiable';
    }

    breakdown.push({
        criterion: 'Email',
        maxPoints: 15,
        earnedPoints: emailPoints,
        reason: emailReason,
    });

    // ────────────────────────────────────────────────────────────
    // 2. Téléphone renseigné et valide (10 pts)
    // ────────────────────────────────────────────────────────────
    const cleanPhone = leadData.telephone.replace(/[\s\-\.()]/g, '');
    let phonePoints = 0;
    let phoneReason = 'Téléphone absent ou trop court';

    if (cleanPhone.length >= 10) {
        phonePoints = 10;
        phoneReason = 'Téléphone complet et valide';
    } else if (cleanPhone.length >= 6) {
        phonePoints = 5;
        phoneReason = 'Téléphone présent mais format court';
    }

    breakdown.push({
        criterion: 'Téléphone',
        maxPoints: 10,
        earnedPoints: phonePoints,
        reason: phoneReason,
    });

    // ────────────────────────────────────────────────────────────
    // 3. Adresse complète (10 pts)
    // ────────────────────────────────────────────────────────────
    let adressePoints = 0;
    let adresseReason = 'Adresse incomplète';

    const hasRue = leadData.adresse && leadData.adresse.length >= 5;
    const hasCp = leadData.codePostal && leadData.codePostal.length === 5;
    const hasVille = leadData.ville && leadData.ville.length >= 2;

    if (hasRue && hasCp && hasVille) {
        adressePoints = 10;
        adresseReason = 'Adresse complète (rue + CP + ville)';
    } else if (hasCp && hasVille) {
        adressePoints = 6;
        adresseReason = 'Code postal et ville présents, rue incomplète';
    } else if (hasCp) {
        adressePoints = 3;
        adresseReason = 'Seul le code postal est renseigné';
    }

    breakdown.push({
        criterion: 'Adresse',
        maxPoints: 10,
        earnedPoints: adressePoints,
        reason: adresseReason,
    });

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

    breakdown.push({
        criterion: 'Formation',
        maxPoints: 15,
        earnedPoints: formationPoints,
        reason: formationReason,
    });

    // ────────────────────────────────────────────────────────────
    // 5. Consentement complet (10 pts)
    // ────────────────────────────────────────────────────────────
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

    breakdown.push({
        criterion: 'Consentement',
        maxPoints: 10,
        earnedPoints: consentPoints,
        reason: consentReason,
    });

    // ────────────────────────────────────────────────────────────
    // 6. Source URL valide (10 pts)
    // ────────────────────────────────────────────────────────────
    let sourcePoints = 0;
    let sourceReason = 'URL source manquante';

    try {
        const url = new URL(leadData.sourceUrl);
        if (url.protocol === 'https:') {
            sourcePoints = 10;
            sourceReason = 'URL HTTPS valide';
        } else {
            sourcePoints = 5;
            sourceReason = 'URL valide mais pas HTTPS';
        }
    } catch {
        sourcePoints = 0;
        sourceReason = 'URL invalide';
    }

    breakdown.push({
        criterion: 'Source URL',
        maxPoints: 10,
        earnedPoints: sourcePoints,
        reason: sourceReason,
    });

    // ────────────────────────────────────────────────────────────
    // 7. Pas de doublon email (15 pts)
    // ────────────────────────────────────────────────────────────
    let dupePoints = 15;
    let dupeReason = 'Aucun doublon détecté';

    try {
        const existingCount = await prisma.lead.count({
            where: {
                email: leadData.email,
                organizationId: leadData.organizationId,
            },
        });

        if (existingCount > 0) {
            dupePoints = 0;
            dupeReason = `Doublon détecté : ${existingCount} lead(s) existant(s) avec cet email`;
        }
    } catch {
        // En cas d'erreur DB, on ne pénalise pas
        dupePoints = 10;
        dupeReason = 'Vérification doublon non disponible';
    }

    breakdown.push({
        criterion: 'Unicité',
        maxPoints: 15,
        earnedPoints: dupePoints,
        reason: dupeReason,
    });

    // ────────────────────────────────────────────────────────────
    // 8. Délai de réponse (15 pts)
    // ────────────────────────────────────────────────────────────
    let delaiPoints = 0;
    let delaiReason = 'Date de réponse non renseignée';

    if (leadData.dateReponse) {
        try {
            const reponseDate = new Date(leadData.dateReponse);
            const now = new Date();
            const diffHours = (now.getTime() - reponseDate.getTime()) / (1000 * 60 * 60);

            if (diffHours <= 24) {
                delaiPoints = 15;
                delaiReason = 'Réponse en moins de 24h — excellent';
            } else if (diffHours <= 48) {
                delaiPoints = 10;
                delaiReason = 'Réponse en moins de 48h — bon';
            } else if (diffHours <= 72) {
                delaiPoints = 5;
                delaiReason = 'Réponse en 48-72h — acceptable';
            } else {
                delaiPoints = 2;
                delaiReason = 'Réponse au-delà de 72h — lead froid';
            }
        } catch {
            delaiPoints = 0;
            delaiReason = 'Date de réponse invalide';
        }
    }

    breakdown.push({
        criterion: 'Délai réponse',
        maxPoints: 15,
        earnedPoints: delaiPoints,
        reason: delaiReason,
    });

    // ────────────────────────────────────────────────────────────
    // TOTAL
    // ────────────────────────────────────────────────────────────
    const totalScore = breakdown.reduce((sum, b) => sum + b.earnedPoints, 0);
    const grade = scoreToGrade(totalScore);

    return { score: totalScore, grade, breakdown };
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
        case 'A': return '#059669'; // emerald
        case 'B': return '#d97706'; // amber
        case 'C': return '#ea580c'; // orange
        case 'D': return '#dc2626'; // red
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
