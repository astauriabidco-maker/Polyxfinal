/**
 * API QUALITY DASHBOARD — Métriques qualité + coûts des leads partenaires
 * ========================================================================
 * GET /api/partners/quality-dashboard?period=30&format=json
 *
 * Params :
 *   period  → 7 | 30 | 90 | all (défaut: all)
 *   format  → json | csv     (défaut: json)
 *
 * Retourne :
 *   - KPIs globaux (total, conversion, rejet, score moyen)
 *   - KPIs financiers (CPL moyen, coût total, CAC, budget)
 *   - Performance par partenaire (avec coûts)
 *   - Distribution des statuts
 *   - Tendance quotidienne
 *   - Top formations demandées
 *   - Couverture géographique
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { scoreToGrade } from '@/lib/prospection/lead-scoring';

// ─── Types ────────────────────────────────────────────────────

interface PartnerMetrics {
    partnerId: string;
    companyName: string;
    status: string;
    totalLeads: number;
    convertedLeads: number;
    rejectedLeads: number;
    avgScore: number;
    conversionRate: number;
    rejectionRate: number;
    grade: 'A' | 'B' | 'C' | 'D';
    lastLeadAt: string | null;
    // Financier
    costPerLead: number | null;
    totalCost: number;
    cac: number | null;           // Coût d'Acquisition Client
}

interface DailyTrend {
    date: string;
    count: number;
    avgScore: number;
    dailyCost: number;
}

interface FormationStat {
    formation: string;
    count: number;
    percentage: number;
}

interface GeoStat {
    department: string;
    count: number;
    percentage: number;
}

interface StatusDistribution {
    status: string;
    count: number;
    percentage: number;
}

// ─── GET Handler ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const orgId = session.user.organizationId;
        const { searchParams } = new URL(req.url);
        const period = searchParams.get('period') || 'all';
        const format = searchParams.get('format') || 'json';

        // ────────────────────────────────────────────────────────
        // 0. Calcul de la fenêtre temporelle
        // ────────────────────────────────────────────────────────
        let dateFilter: Date | null = null;
        const now = new Date();

        if (period === '7') {
            dateFilter = new Date(now);
            dateFilter.setDate(dateFilter.getDate() - 7);
        } else if (period === '30') {
            dateFilter = new Date(now);
            dateFilter.setDate(dateFilter.getDate() - 30);
        } else if (period === '90') {
            dateFilter = new Date(now);
            dateFilter.setDate(dateFilter.getDate() - 90);
        }
        // 'all' → dateFilter reste null

        const trendDays = period === '7' ? 7 : period === '90' ? 90 : 30;
        const trendCutoff = new Date(now);
        trendCutoff.setDate(trendCutoff.getDate() - trendDays);

        // ────────────────────────────────────────────────────────
        // 1. Récupérer les leads et les partenaires
        // ────────────────────────────────────────────────────────
        const leads = await prisma.lead.findMany({
            where: {
                organizationId: orgId,
                source: 'PARTNER_API',
                ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
            },
            select: {
                id: true,
                status: true,
                score: true,
                codePostal: true,
                formationSouhaitee: true,
                createdAt: true,
                partnerId: true,
                partner: {
                    select: {
                        id: true,
                        companyName: true,
                        status: true,
                        costPerLead: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const totalLeads = leads.length;

        if (totalLeads === 0) {
            const emptyResponse = {
                period,
                kpis: {
                    totalLeads: 0, conversionRate: 0, rejectionRate: 0,
                    avgScore: 0, avgGrade: 'D', leadsThisMonth: 0, trend: 0,
                },
                costs: {
                    avgCostPerLead: 0, totalCost: 0, cac: 0,
                    costThisMonth: 0, budgetTrend: 0,
                },
                partners: [],
                statusDistribution: [],
                dailyTrend: [],
                topFormations: [],
                geoDistribution: [],
            };

            if (format === 'csv') {
                return buildCsvResponse([], period);
            }
            return NextResponse.json(emptyResponse);
        }

        // ────────────────────────────────────────────────────────
        // 2. KPIs globaux
        // ────────────────────────────────────────────────────────
        const convertedLeads = leads.filter(l => l.status === 'CONVERTED').length;
        const rejectedLeads = leads.filter(l => l.status === 'LOST').length;
        const scoredLeads = leads.filter(l => l.score !== null);
        const avgScore = scoredLeads.length > 0
            ? Math.round(scoredLeads.reduce((sum, l) => sum + (l.score || 0), 0) / scoredLeads.length)
            : 0;

        // Tendance vs mois précédent
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const leadsThisMonth = leads.filter(l => new Date(l.createdAt) >= thisMonthStart).length;
        const leadsLastMonth = leads.filter(l => {
            const d = new Date(l.createdAt);
            return d >= lastMonthStart && d <= lastMonthEnd;
        }).length;

        const trend = leadsLastMonth > 0
            ? Math.round(((leadsThisMonth - leadsLastMonth) / leadsLastMonth) * 100)
            : (leadsThisMonth > 0 ? 100 : 0);

        // ────────────────────────────────────────────────────────
        // 3. KPIs financiers
        // ────────────────────────────────────────────────────────
        let totalCost = 0;
        let costableLeads = 0;

        for (const lead of leads) {
            if (lead.partner?.costPerLead) {
                totalCost += Number(lead.partner.costPerLead);
                costableLeads++;
            }
        }

        const avgCostPerLead = costableLeads > 0 ? Math.round(totalCost / costableLeads * 100) / 100 : 0;
        const cac = convertedLeads > 0 ? Math.round(totalCost / convertedLeads * 100) / 100 : 0;

        // Coût ce mois
        let costThisMonth = 0;
        for (const lead of leads) {
            if (new Date(lead.createdAt) >= thisMonthStart && lead.partner?.costPerLead) {
                costThisMonth += Number(lead.partner.costPerLead);
            }
        }

        let costLastMonth = 0;
        for (const lead of leads) {
            const d = new Date(lead.createdAt);
            if (d >= lastMonthStart && d <= lastMonthEnd && lead.partner?.costPerLead) {
                costLastMonth += Number(lead.partner.costPerLead);
            }
        }

        const budgetTrend = costLastMonth > 0
            ? Math.round(((costThisMonth - costLastMonth) / costLastMonth) * 100)
            : (costThisMonth > 0 ? 100 : 0);

        // ────────────────────────────────────────────────────────
        // 4. Distribution des statuts
        // ────────────────────────────────────────────────────────
        const statusCounts = new Map<string, number>();
        for (const lead of leads) {
            statusCounts.set(lead.status, (statusCounts.get(lead.status) || 0) + 1);
        }

        const statusDistribution: StatusDistribution[] = Array.from(statusCounts.entries())
            .map(([status, count]) => ({
                status,
                count,
                percentage: Math.round((count / totalLeads) * 1000) / 10,
            }))
            .sort((a, b) => b.count - a.count);

        // ────────────────────────────────────────────────────────
        // 5. Performance par partenaire (avec coûts)
        // ────────────────────────────────────────────────────────
        const partnerMap = new Map<string, {
            companyName: string;
            status: string;
            costPerLead: number | null;
            leads: typeof leads;
        }>();

        for (const lead of leads) {
            if (!lead.partnerId || !lead.partner) continue;
            const existing = partnerMap.get(lead.partnerId);
            if (existing) {
                existing.leads.push(lead);
            } else {
                partnerMap.set(lead.partnerId, {
                    companyName: lead.partner.companyName,
                    status: lead.partner.status,
                    costPerLead: lead.partner.costPerLead ? Number(lead.partner.costPerLead) : null,
                    leads: [lead],
                });
            }
        }

        const partners: PartnerMetrics[] = Array.from(partnerMap.entries()).map(([partnerId, data]) => {
            const pLeads = data.leads;
            const pConverted = pLeads.filter(l => l.status === 'CONVERTED').length;
            const pRejected = pLeads.filter(l => l.status === 'LOST').length;
            const pScored = pLeads.filter(l => l.score !== null);
            const pAvgScore = pScored.length > 0
                ? Math.round(pScored.reduce((sum, l) => sum + (l.score || 0), 0) / pScored.length)
                : 0;

            const lastLead = pLeads.length > 0 ? pLeads[0].createdAt : null;
            const pTotalCost = data.costPerLead ? data.costPerLead * pLeads.length : 0;
            const pCac = pConverted > 0 && data.costPerLead ? Math.round(pTotalCost / pConverted * 100) / 100 : null;

            return {
                partnerId,
                companyName: data.companyName,
                status: data.status,
                totalLeads: pLeads.length,
                convertedLeads: pConverted,
                rejectedLeads: pRejected,
                avgScore: pAvgScore,
                conversionRate: pLeads.length > 0 ? Math.round((pConverted / pLeads.length) * 1000) / 10 : 0,
                rejectionRate: pLeads.length > 0 ? Math.round((pRejected / pLeads.length) * 1000) / 10 : 0,
                grade: scoreToGrade(pAvgScore),
                lastLeadAt: lastLead ? lastLead.toISOString() : null,
                costPerLead: data.costPerLead,
                totalCost: Math.round(pTotalCost * 100) / 100,
                cac: pCac,
            };
        }).sort((a, b) => b.avgScore - a.avgScore);

        // ────────────────────────────────────────────────────────
        // 6. Tendance quotidienne (avec coûts)
        // ────────────────────────────────────────────────────────
        const dailyMap = new Map<string, { count: number; scoreSum: number; scored: number; cost: number }>();

        for (let i = 0; i < trendDays; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            dailyMap.set(key, { count: 0, scoreSum: 0, scored: 0, cost: 0 });
        }

        for (const lead of leads) {
            const d = new Date(lead.createdAt);
            if (d < trendCutoff) continue;
            const key = d.toISOString().split('T')[0];
            const day = dailyMap.get(key);
            if (day) {
                day.count++;
                if (lead.score !== null) {
                    day.scoreSum += lead.score;
                    day.scored++;
                }
                if (lead.partner?.costPerLead) {
                    day.cost += Number(lead.partner.costPerLead);
                }
            }
        }

        const dailyTrend: DailyTrend[] = Array.from(dailyMap.entries())
            .map(([date, data]) => ({
                date,
                count: data.count,
                avgScore: data.scored > 0 ? Math.round(data.scoreSum / data.scored) : 0,
                dailyCost: Math.round(data.cost * 100) / 100,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // ────────────────────────────────────────────────────────
        // 7. Top formations demandées
        // ────────────────────────────────────────────────────────
        const formationMap = new Map<string, number>();
        for (const lead of leads) {
            if (lead.formationSouhaitee) {
                const formation = lead.formationSouhaitee.trim();
                formationMap.set(formation, (formationMap.get(formation) || 0) + 1);
            }
        }

        const topFormations: FormationStat[] = Array.from(formationMap.entries())
            .map(([formation, count]) => ({
                formation,
                count,
                percentage: Math.round((count / totalLeads) * 1000) / 10,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // ────────────────────────────────────────────────────────
        // 8. Distribution géographique
        // ────────────────────────────────────────────────────────
        const geoMap = new Map<string, number>();
        for (const lead of leads) {
            if (lead.codePostal && lead.codePostal.length >= 2) {
                const dept = lead.codePostal.substring(0, 2);
                geoMap.set(dept, (geoMap.get(dept) || 0) + 1);
            }
        }

        const geoDistribution: GeoStat[] = Array.from(geoMap.entries())
            .map(([department, count]) => ({
                department,
                count,
                percentage: Math.round((count / totalLeads) * 1000) / 10,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);

        // ────────────────────────────────────────────────────────
        // Réponse
        // ────────────────────────────────────────────────────────

        // Export CSV
        if (format === 'csv') {
            return buildCsvResponse(partners, period);
        }

        return NextResponse.json({
            period,
            kpis: {
                totalLeads,
                conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0,
                rejectionRate: totalLeads > 0 ? Math.round((rejectedLeads / totalLeads) * 1000) / 10 : 0,
                avgScore,
                avgGrade: scoreToGrade(avgScore),
                leadsThisMonth,
                trend,
            },
            costs: {
                avgCostPerLead,
                totalCost: Math.round(totalCost * 100) / 100,
                cac,
                costThisMonth: Math.round(costThisMonth * 100) / 100,
                budgetTrend,
            },
            partners,
            statusDistribution,
            dailyTrend,
            topFormations,
            geoDistribution,
        });

    } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        const errStack = error instanceof Error ? error.stack : '';
        console.error('[Quality Dashboard] Error:', errMessage);
        console.error('[Quality Dashboard] Stack:', errStack);
        return NextResponse.json({ error: 'Erreur serveur', details: errMessage }, { status: 500 });
    }
}

// ─── CSV Export ───────────────────────────────────────────────

function buildCsvResponse(partners: PartnerMetrics[], period: string): NextResponse {
    const BOM = '\uFEFF';
    const headers = [
        'Partenaire', 'Statut', 'Leads', 'Convertis', 'Rejetés',
        'Taux Conv. (%)', 'Taux Rejet (%)', 'Score Moyen', 'Grade',
        'CPL (€)', 'Coût Total (€)', 'CAC (€)', 'Dernier Lead',
    ];

    const rows = partners.map(p => [
        `"${p.companyName}"`,
        p.status,
        p.totalLeads,
        p.convertedLeads,
        p.rejectedLeads,
        p.conversionRate,
        p.rejectionRate,
        p.avgScore,
        p.grade,
        p.costPerLead ?? '',
        p.totalCost,
        p.cac ?? '',
        p.lastLeadAt ? new Date(p.lastLeadAt).toLocaleDateString('fr-FR') : '',
    ].join(';'));

    const csv = BOM + [headers.join(';'), ...rows].join('\n');
    const filename = `qualite-leads-${period}-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
