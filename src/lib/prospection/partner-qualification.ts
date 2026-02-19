/**
 * SERVICE QUALIFICATION PARTENAIRE
 * ===================================
 * Qualiopi Ind. 17 — Convention de sous-traitance
 * Qualiopi Ind. 26 — Contrôle qualité des intervenants externes
 * 
 * Ce service gère l'évaluation, le scoring et le contrôle qualité
 * des partenaires apporteurs d'affaires.
 * 
 * Grille de scoring (100 points) :
 *   Convention sous-traitance signée : 20 pts
 *   DPA (RGPD Art. 28) signé        : 15 pts
 *   Contrat commercial signé         : 10 pts
 *   K-Bis à jour                     : 10 pts
 *   RC Professionnelle               : 15 pts (obligatoire)
 *   Attestation URSSAF               : 10 pts
 *   Références fournies              : 10 pts
 *   Certifications                   :  5 pts
 *   Charte qualité signée            :  5 pts
 * 
 * Grades :
 *   A (≥80) : Qualifié — Conformité totale
 *   B (≥60) : Qualifié — Conformité suffisante (seuil minimal)
 *   C (≥40) : Non qualifié — Actions correctives nécessaires
 *   D (<40) : Non qualifié — Risque élevé
 */

import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/prisma';

// ─── Dependency Injection (même pattern que les autres modules) ──

let prismaInstance: any = null;

export function setPrismaInstance(instance: any): void {
    prismaInstance = instance;
}

function getPrisma(): any {
    return prismaInstance || defaultPrisma;
}

// ─── Constants ────────────────────────────────────────────────

export const QUALIFICATION_THRESHOLD = 60; // Score minimum pour être "qualifié"

export const SCORING_GRID = {
    conventionSigned: { points: 20, label: 'Convention sous-traitance signée', category: 'Ind. 17' },
    dpaSigned: { points: 15, label: 'DPA (RGPD Art. 28) signé', category: 'RGPD' },
    contractSigned: { points: 10, label: 'Contrat commercial signé', category: 'Contractuel' },
    hasKbis: { points: 10, label: 'Extrait K-Bis à jour', category: 'Ind. 26' },
    hasRcPro: { points: 15, label: 'Assurance RC Professionnelle', category: 'Ind. 26' },
    hasUrssaf: { points: 10, label: 'Attestation URSSAF < 6 mois', category: 'Ind. 26' },
    hasReferences: { points: 10, label: 'Références clients fournies', category: 'Ind. 26' },
    hasCertifications: { points: 5, label: 'Certifications/agréments fournis', category: 'Ind. 26' },
    hasQualityCharter: { points: 5, label: 'Charte qualité signée', category: 'Ind. 26' },
} as const;

export const MAX_SCORE = Object.values(SCORING_GRID).reduce((s, v) => s + v.points, 0); // 100

// ─── Types ────────────────────────────────────────────────────

export interface QualificationScoreDetail {
    criterion: string;
    label: string;
    category: string;
    points: number;
    maxPoints: number;
    met: boolean;
    detail?: string;
}

export interface QualificationResult {
    partnerId: string;
    companyName: string;
    score: number;
    maxScore: number;
    grade: string;
    isQualified: boolean;
    details: QualificationScoreDetail[];
    missingCriteria: string[];
    conventionStatus: 'SIGNED' | 'EXPIRED' | 'MISSING';
    alerts: string[];
}

export interface QualificationStats {
    total: number;
    qualified: number;
    nonQualified: number;
    avgScore: number;
    gradeDistribution: Record<string, number>;
    commonMissing: { criterion: string; count: number }[];
    conventionsSigned: number;
    conventionsExpired: number;
    conventionsMissing: number;
    reviewsDueSoon: number;
}

// ─── Scoring Engine ──────────────────────────────────────────

/**
 * Calcule le score de qualification d'un partenaire en combinant
 * les données du modèle Partner et de PartnerQualification.
 */
export function computeQualificationScore(
    partner: {
        dpaSignedAt: Date | null;
        contractSignedAt: Date | null;
        contractExpiresAt: Date | null;
        companyName: string;
    },
    qualification: {
        conventionSignedAt: Date | null;
        conventionExpiresAt: Date | null;
        hasKbis: boolean;
        hasRcPro: boolean;
        hasUrssaf: boolean;
        hasReferences: boolean;
        hasCertifications: boolean;
        hasQualityCharter: boolean;
        rcProExpiresAt?: Date | null;
        urssafDate?: Date | null;
        kbisDate?: Date | null;
    } | null,
): QualificationResult {
    const now = new Date();
    const details: QualificationScoreDetail[] = [];
    const alerts: string[] = [];
    const q = qualification;

    // Convention sous-traitance
    const conventionSigned = q?.conventionSignedAt != null;
    const conventionExpired = q?.conventionExpiresAt != null && new Date(q.conventionExpiresAt) < now;
    const conventionValid = conventionSigned && !conventionExpired;

    details.push({
        criterion: 'conventionSigned',
        label: SCORING_GRID.conventionSigned.label,
        category: SCORING_GRID.conventionSigned.category,
        maxPoints: SCORING_GRID.conventionSigned.points,
        points: conventionValid ? SCORING_GRID.conventionSigned.points : 0,
        met: conventionValid,
        detail: conventionExpired ? 'Convention expirée' : !conventionSigned ? 'Non signée' : undefined,
    });
    if (conventionExpired) alerts.push('Convention de sous-traitance expirée');
    if (!conventionSigned) alerts.push('Convention de sous-traitance non signée (Ind. 17)');

    // DPA
    const dpaSigned = partner.dpaSignedAt != null;
    details.push({
        criterion: 'dpaSigned',
        label: SCORING_GRID.dpaSigned.label,
        category: SCORING_GRID.dpaSigned.category,
        maxPoints: SCORING_GRID.dpaSigned.points,
        points: dpaSigned ? SCORING_GRID.dpaSigned.points : 0,
        met: dpaSigned,
    });
    if (!dpaSigned) alerts.push('DPA non signé — obligation RGPD Art. 28');

    // Contrat
    const contractSigned = partner.contractSignedAt != null;
    const contractExpired = partner.contractExpiresAt != null && new Date(partner.contractExpiresAt) < now;
    const contractValid = contractSigned && !contractExpired;
    details.push({
        criterion: 'contractSigned',
        label: SCORING_GRID.contractSigned.label,
        category: SCORING_GRID.contractSigned.category,
        maxPoints: SCORING_GRID.contractSigned.points,
        points: contractValid ? SCORING_GRID.contractSigned.points : 0,
        met: contractValid,
        detail: contractExpired ? 'Contrat expiré' : undefined,
    });
    if (contractExpired) alerts.push('Contrat commercial expiré');

    // Critères Ind. 26 (documents partenaire)
    const boolCriteria: { key: keyof typeof SCORING_GRID; value: boolean; alertMsg?: string }[] = [
        { key: 'hasKbis', value: q?.hasKbis ?? false },
        { key: 'hasRcPro', value: q?.hasRcPro ?? false, alertMsg: 'RC Pro manquante — risque juridique' },
        { key: 'hasUrssaf', value: q?.hasUrssaf ?? false },
        { key: 'hasReferences', value: q?.hasReferences ?? false },
        { key: 'hasCertifications', value: q?.hasCertifications ?? false },
        { key: 'hasQualityCharter', value: q?.hasQualityCharter ?? false },
    ];

    for (const { key, value, alertMsg } of boolCriteria) {
        const rule = SCORING_GRID[key];
        details.push({
            criterion: key,
            label: rule.label,
            category: rule.category,
            maxPoints: rule.points,
            points: value ? rule.points : 0,
            met: value,
        });
        if (!value && alertMsg) alerts.push(alertMsg);
    }

    // Alertes temporelles
    if (q?.rcProExpiresAt && new Date(q.rcProExpiresAt) < now) {
        alerts.push('RC Pro expirée');
        // Retire les points RC Pro si expirée
        const rcDetail = details.find(d => d.criterion === 'hasRcPro');
        if (rcDetail) { rcDetail.points = 0; rcDetail.met = false; rcDetail.detail = 'Expirée'; }
    }

    if (q?.urssafDate) {
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        if (new Date(q.urssafDate) < sixMonthsAgo) {
            alerts.push('Attestation URSSAF de plus de 6 mois');
            const ursDetail = details.find(d => d.criterion === 'hasUrssaf');
            if (ursDetail) { ursDetail.points = 0; ursDetail.met = false; ursDetail.detail = '> 6 mois'; }
        }
    }

    if (q?.kbisDate) {
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        if (new Date(q.kbisDate) < threeMonthsAgo) {
            alerts.push('K-Bis de plus de 3 mois');
            const kbisDetail = details.find(d => d.criterion === 'hasKbis');
            if (kbisDetail) { kbisDetail.points = 0; kbisDetail.met = false; kbisDetail.detail = '> 3 mois'; }
        }
    }

    // Calcul total
    const score = details.reduce((s, d) => s + d.points, 0);
    const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
    const isQualified = score >= QUALIFICATION_THRESHOLD;
    const missingCriteria = details.filter(d => !d.met).map(d => d.label);

    const conventionStatus: 'SIGNED' | 'EXPIRED' | 'MISSING' = conventionExpired
        ? 'EXPIRED'
        : conventionSigned
            ? 'SIGNED'
            : 'MISSING';

    return {
        partnerId: '',
        companyName: partner.companyName,
        score,
        maxScore: MAX_SCORE,
        grade,
        isQualified,
        details,
        missingCriteria,
        conventionStatus,
        alerts,
    };
}

// ─── Database Operations ─────────────────────────────────────

/**
 * Évalue et persiste le score de qualification d'un partenaire.
 */
export async function evaluatePartner(
    partnerId: string,
    evaluatedBy?: string,
    notes?: string,
): Promise<QualificationResult> {
    const prisma = getPrisma();

    const partner = await prisma.partner.findUniqueOrThrow({
        where: { id: partnerId },
        include: { qualification: true },
    });

    const result = computeQualificationScore(partner, partner.qualification);
    result.partnerId = partnerId;

    // Upsert dans PartnerQualification
    await prisma.partnerQualification.upsert({
        where: { partnerId },
        create: {
            partnerId,
            organizationId: partner.organizationId,
            qualificationScore: result.score,
            qualificationGrade: result.grade,
            isQualified: result.isQualified,
            lastEvaluationAt: new Date(),
            nextReviewAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // +90 jours
            evaluatedBy: evaluatedBy || 'SYSTEM',
            evaluationNotes: notes || null,
        },
        update: {
            qualificationScore: result.score,
            qualificationGrade: result.grade,
            isQualified: result.isQualified,
            lastEvaluationAt: new Date(),
            nextReviewAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            evaluatedBy: evaluatedBy || 'SYSTEM',
            evaluationNotes: notes || null,
        },
    });

    return result;
}

/**
 * Évalue tous les partenaires actifs d'une organisation.
 */
export async function evaluateAllPartners(organizationId: string): Promise<QualificationResult[]> {
    const prisma = getPrisma();

    const partners = await prisma.partner.findMany({
        where: { organizationId, status: 'ACTIVE' },
        include: { qualification: true },
    });

    const results: QualificationResult[] = [];

    for (const partner of partners) {
        const result = computeQualificationScore(partner, partner.qualification);
        result.partnerId = partner.id;

        // Persist
        await prisma.partnerQualification.upsert({
            where: { partnerId: partner.id },
            create: {
                partnerId: partner.id,
                organizationId,
                qualificationScore: result.score,
                qualificationGrade: result.grade,
                isQualified: result.isQualified,
                lastEvaluationAt: new Date(),
                nextReviewAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                evaluatedBy: 'SYSTEM',
            },
            update: {
                qualificationScore: result.score,
                qualificationGrade: result.grade,
                isQualified: result.isQualified,
                lastEvaluationAt: new Date(),
            },
        });

        results.push(result);
    }

    return results;
}

/**
 * Met à jour la checklist documentaire d'un partenaire (Ind. 26).
 */
export async function updatePartnerDocuments(
    partnerId: string,
    documents: {
        hasKbis?: boolean;
        hasRcPro?: boolean;
        hasUrssaf?: boolean;
        hasReferences?: boolean;
        hasCertifications?: boolean;
        hasQualityCharter?: boolean;
        certificationDetails?: string;
        referencesDetails?: string;
        rcProPolicyNumber?: string;
        rcProExpiresAt?: Date | null;
        urssafDate?: Date | null;
        kbisDate?: Date | null;
    },
): Promise<QualificationResult> {
    const prisma = getPrisma();

    const partner = await prisma.partner.findUniqueOrThrow({
        where: { id: partnerId },
    });

    // Upsert qualification with documents
    await prisma.partnerQualification.upsert({
        where: { partnerId },
        create: {
            partnerId,
            organizationId: partner.organizationId,
            ...documents,
        },
        update: documents,
    });

    // Re-evaluate
    return evaluatePartner(partnerId);
}

/**
 * Enregistre une convention de sous-traitance (Ind. 17).
 */
export async function recordConvention(
    partnerId: string,
    data: {
        signedAt: Date;
        url?: string;
        expiresAt?: Date;
        type?: 'PROSPECTION' | 'FORMATION' | 'MIXTE';
    },
): Promise<QualificationResult> {
    const prisma = getPrisma();

    const partner = await prisma.partner.findUniqueOrThrow({
        where: { id: partnerId },
    });

    await prisma.partnerQualification.upsert({
        where: { partnerId },
        create: {
            partnerId,
            organizationId: partner.organizationId,
            conventionSignedAt: data.signedAt,
            conventionUrl: data.url || null,
            conventionExpiresAt: data.expiresAt || null,
            conventionType: data.type || 'PROSPECTION',
        },
        update: {
            conventionSignedAt: data.signedAt,
            conventionUrl: data.url || null,
            conventionExpiresAt: data.expiresAt || null,
            conventionType: data.type || 'PROSPECTION',
        },
    });

    // Re-evaluate
    return evaluatePartner(partnerId);
}

/**
 * Statistiques globales de qualification (pour le dashboard).
 */
export async function getQualificationStats(organizationId: string): Promise<QualificationStats> {
    const prisma = getPrisma();

    const partners = await prisma.partner.findMany({
        where: { organizationId, status: 'ACTIVE' },
        include: { qualification: true },
    });

    const qualifications: QualificationResult[] = partners.map((p: any) => {
        const result = computeQualificationScore(p, p.qualification);
        result.partnerId = p.id;
        return result;
    });

    const total = qualifications.length;
    const qualified = qualifications.filter(q => q.isQualified).length;
    const nonQualified = total - qualified;
    const avgScore = total > 0 ? Math.round(qualifications.reduce((s, q) => s + q.score, 0) / total) : 0;

    // Distribution grades
    const gradeDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const q of qualifications) {
        gradeDistribution[q.grade] = (gradeDistribution[q.grade] || 0) + 1;
    }

    // Critères les plus souvent manquants
    const missingCount: Record<string, number> = {};
    for (const q of qualifications) {
        for (const m of q.missingCriteria) {
            missingCount[m] = (missingCount[m] || 0) + 1;
        }
    }
    const commonMissing = Object.entries(missingCount)
        .map(([criterion, count]) => ({ criterion, count }))
        .sort((a, b) => b.count - a.count);

    // Convention stats
    const conventionsSigned = qualifications.filter(q => q.conventionStatus === 'SIGNED').length;
    const conventionsExpired = qualifications.filter(q => q.conventionStatus === 'EXPIRED').length;
    const conventionsMissing = qualifications.filter(q => q.conventionStatus === 'MISSING').length;

    // Revues à venir (30 jours)
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const reviewsDueSoon = partners.filter((p: any) =>
        p.qualification?.nextReviewAt && new Date(p.qualification.nextReviewAt) <= in30Days,
    ).length;

    return {
        total,
        qualified,
        nonQualified,
        avgScore,
        gradeDistribution,
        commonMissing,
        conventionsSigned,
        conventionsExpired,
        conventionsMissing,
        reviewsDueSoon,
    };
}

/**
 * Vérifie si un partenaire est qualifié pour l'ingestion de leads.
 * Retourne null si qualifié, ou un objet d'erreur si non qualifié.
 */
export function checkPartnerQualification(
    partner: {
        companyName: string;
        dpaSignedAt: Date | null;
        contractSignedAt: Date | null;
        contractExpiresAt: Date | null;
    },
    qualification: {
        conventionSignedAt: Date | null;
        conventionExpiresAt: Date | null;
        isQualified: boolean;
        qualificationScore: number;
        hasKbis: boolean;
        hasRcPro: boolean;
        hasUrssaf: boolean;
        hasReferences: boolean;
        hasCertifications: boolean;
        hasQualityCharter: boolean;
    } | null,
): { code: string; message: string } | null {
    // Si pas de qualification du tout, on avertit mais on ne bloque pas
    // (rétrocompatibilité — activation progressive)
    if (!qualification) {
        console.warn(`[Qualification] ⚠️ Partner ${partner.companyName} sans dossier de qualification`);
        return null;
    }

    // Convention sous-traitance obligatoire pour Qualiopi
    if (!qualification.conventionSignedAt) {
        return {
            code: 'QUALIOPI_CONVENTION_MISSING',
            message: 'Convention de sous-traitance non signée (Qualiopi Ind. 17). ' +
                'Ce document est obligatoire pour les organismes certifiés Qualiopi.',
        };
    }

    // Convention expirée
    if (qualification.conventionExpiresAt && new Date(qualification.conventionExpiresAt) < new Date()) {
        return {
            code: 'QUALIOPI_CONVENTION_EXPIRED',
            message: 'Convention de sous-traitance expirée. Veuillez la renouveler.',
        };
    }

    // Score minimum non atteint
    if (!qualification.isQualified) {
        return {
            code: 'QUALIOPI_SCORE_INSUFFICIENT',
            message: `Score de qualification insuffisant (${qualification.qualificationScore}/${MAX_SCORE}). ` +
                `Le minimum requis est ${QUALIFICATION_THRESHOLD}/100.`,
        };
    }

    return null; // Qualifié ✅
}
