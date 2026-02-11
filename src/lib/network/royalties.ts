/**
 * ROYALTIES — Calcul des Redevances Franchise
 * =============================================
 * Calcule les redevances dues par un franchisé pour un mois donné.
 * 
 * Taux différenciés:
 * - ORGANIC (acquis par le franchisé) → royaltyRate (ex: 5%)
 * - NETWORK_DISPATCH (apporté par le siège) → leadFeeRate (ex: 15%)
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Types ────────────────────────────────────────────────────

interface RoyaltyBreakdown {
    source: 'ORGANIC' | 'NETWORK_DISPATCH';
    /** Chiffre d'affaires total */
    ca: number;
    /** Nombre de contrats */
    contractCount: number;
    /** Taux appliqué (%) */
    rate: number;
    /** Montant dû */
    due: number;
}

interface RoyaltyResult {
    organizationId: string;
    organizationName: string;
    parentId: string;
    parentName: string;
    /** Mois calculé (YYYY-MM) */
    month: string;
    /** Breakdown par source */
    organic: RoyaltyBreakdown;
    dispatch: RoyaltyBreakdown;
    /** Total des redevances dues */
    totalDue: number;
    /** CA total */
    totalCa: number;
}

// ─── Utilitaire ───────────────────────────────────────────────

function decimalToNumber(val: Decimal | null | undefined): number {
    if (!val) return 0;
    return Number(val);
}

// ─── Calcul Principal ─────────────────────────────────────────

/**
 * Calcule les redevances dues par un franchisé pour un mois donné.
 * 
 * @param organizationId - ID de l'organisation franchisée
 * @param month - Mois au format "YYYY-MM" (ex: "2024-06")
 */
export async function getRoyaltiesDue(
    organizationId: string,
    month: string
): Promise<RoyaltyResult> {
    // 1. Charger l'organisation et son parent
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
            parent: {
                select: { id: true, name: true },
            },
        },
    });

    if (!org) {
        throw new Error(`Organisation introuvable: ${organizationId}`);
    }

    if (!org.parentId || !org.parent) {
        throw new Error(`L'organisation "${org.name}" n'a pas de parent — les redevances ne s'appliquent qu'aux franchisés`);
    }

    if (org.networkType !== 'FRANCHISE' && org.networkType !== 'SUCCURSALE') {
        throw new Error(`Les redevances ne s'appliquent qu'aux FRANCHISE/SUCCURSALE (actuel: ${org.networkType})`);
    }

    // 2. Calculer la plage de dates du mois
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59); // Dernier jour du mois

    // 3. Récupérer les contrats validés pour ce mois
    const contrats = await prisma.contrat.findMany({
        where: {
            dossier: {
                organizationId,
            },
            status: 'ACTIF',
            isSigned: true,
            dateSignature: {
                gte: startDate,
                lte: endDate,
            },
        },
        include: {
            dossier: {
                select: {
                    source: true,
                },
            },
        },
    });

    // 4. Calculer le CA par source
    let organicCa = 0;
    let organicCount = 0;
    let dispatchCa = 0;
    let dispatchCount = 0;

    for (const contrat of contrats) {
        const montantHT = decimalToNumber(contrat.montantHT);

        if (contrat.dossier.source === 'NETWORK_DISPATCH') {
            dispatchCa += montantHT;
            dispatchCount++;
        } else {
            organicCa += montantHT;
            organicCount++;
        }
    }

    // 5. Appliquer les taux
    const royaltyRate = org.royaltyRate ?? 5.0;
    const leadFeeRate = org.leadFeeRate ?? 15.0;

    const organicDue = Math.round(organicCa * (royaltyRate / 100) * 100) / 100;
    const dispatchDue = Math.round(dispatchCa * (leadFeeRate / 100) * 100) / 100;

    return {
        organizationId: org.id,
        organizationName: org.name,
        parentId: org.parent.id,
        parentName: org.parent.name,
        month,
        organic: {
            source: 'ORGANIC',
            ca: organicCa,
            contractCount: organicCount,
            rate: royaltyRate,
            due: organicDue,
        },
        dispatch: {
            source: 'NETWORK_DISPATCH',
            ca: dispatchCa,
            contractCount: dispatchCount,
            rate: leadFeeRate,
            due: dispatchDue,
        },
        totalDue: organicDue + dispatchDue,
        totalCa: organicCa + dispatchCa,
    };
}

// ─── Récapitulatif Réseau ─────────────────────────────────────

/**
 * Calcule les redevances de TOUS les franchisés d'un HEAD_OFFICE.
 */
export async function getNetworkRoyaltiesSummary(
    headOfficeId: string,
    month: string
): Promise<{
    headOfficeId: string;
    month: string;
    franchises: RoyaltyResult[];
    totalNetworkDue: number;
    totalNetworkCa: number;
}> {
    const children = await prisma.organization.findMany({
        where: {
            parentId: headOfficeId,
            isActive: true,
            networkType: { in: ['FRANCHISE', 'SUCCURSALE'] },
        },
        select: { id: true },
    });

    const results: RoyaltyResult[] = [];

    for (const child of children) {
        const royalty = await getRoyaltiesDue(child.id, month);
        results.push(royalty);
    }

    return {
        headOfficeId,
        month,
        franchises: results,
        totalNetworkDue: results.reduce((sum, r) => sum + r.totalDue, 0),
        totalNetworkCa: results.reduce((sum, r) => sum + r.totalCa, 0),
    };
}
