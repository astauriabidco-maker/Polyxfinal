/**
 * MESSAGING ANALYTICS API
 * ========================
 * Computes delivery rates, read rates, response rates,
 * average response time, best sending slots, and cost estimates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const orgId = session.user.organizationId;
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30', 10);
        const since = new Date();
        since.setDate(since.getDate() - days);

        // ─── 1. Global message counts ────────────────────────

        const outbound = await (prisma as any).message.findMany({
            where: { organizationId: orgId, direction: 'OUTBOUND', createdAt: { gte: since } },
            select: { id: true, status: true, templateKey: true, createdAt: true },
        });

        const inbound = await (prisma as any).message.findMany({
            where: { organizationId: orgId, direction: 'INBOUND', createdAt: { gte: since } },
            select: { id: true, phone: true, createdAt: true },
        });

        const totalOutbound = outbound.length;
        const delivered = outbound.filter((m: any) => ['DELIVERED', 'READ'].includes(m.status)).length;
        const read = outbound.filter((m: any) => m.status === 'READ').length;
        const failed = outbound.filter((m: any) => m.status === 'FAILED').length;

        const deliveryRate = totalOutbound > 0 ? Math.round((delivered / totalOutbound) * 1000) / 10 : 0;
        const readRate = totalOutbound > 0 ? Math.round((read / totalOutbound) * 1000) / 10 : 0;
        const failRate = totalOutbound > 0 ? Math.round((failed / totalOutbound) * 1000) / 10 : 0;

        // ─── 2. Response rate ────────────────────────────────
        // Count unique phones that received outbound AND sent inbound

        const outboundPhones = new Set(
            await (prisma as any).message.findMany({
                where: { organizationId: orgId, direction: 'OUTBOUND', createdAt: { gte: since } },
                select: { phone: true },
                distinct: ['phone'],
            }).then((msgs: any[]) => msgs.map(m => m.phone))
        );

        const inboundPhones = new Set(inbound.map((m: any) => m.phone));
        const respondedPhones = Array.from(outboundPhones).filter(p => inboundPhones.has(p));
        const responseRate = outboundPhones.size > 0
            ? Math.round((respondedPhones.length / outboundPhones.size) * 1000) / 10
            : 0;

        // ─── 3. Average response time ───────────────────────
        // For each inbound message, find the last outbound to same phone before it

        const allOutboundSorted = await (prisma as any).message.findMany({
            where: { organizationId: orgId, direction: 'OUTBOUND', createdAt: { gte: since } },
            select: { phone: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        // Build a map of phone -> sorted outbound timestamps
        const outboundByPhone: Record<string, Date[]> = {};
        for (const msg of allOutboundSorted) {
            if (!outboundByPhone[msg.phone]) outboundByPhone[msg.phone] = [];
            outboundByPhone[msg.phone].push(new Date(msg.createdAt));
        }

        let totalResponseTimeMinutes = 0;
        let responseCount = 0;

        for (const inMsg of inbound) {
            const outTimes = outboundByPhone[inMsg.phone];
            if (!outTimes || outTimes.length === 0) continue;

            const inTime = new Date(inMsg.createdAt).getTime();
            // Find last outbound before this inbound
            let lastOutbound: Date | null = null;
            for (const ot of outTimes) {
                if (ot.getTime() < inTime) lastOutbound = ot;
                else break;
            }

            if (lastOutbound) {
                const diffMinutes = (inTime - lastOutbound.getTime()) / (1000 * 60);
                if (diffMinutes <= 1440) { // Only count if response within 24h
                    totalResponseTimeMinutes += diffMinutes;
                    responseCount++;
                }
            }
        }

        const avgResponseMinutes = responseCount > 0
            ? Math.round(totalResponseTimeMinutes / responseCount)
            : null;

        // Format as "Xh Ym"
        let avgResponseFormatted = null;
        if (avgResponseMinutes !== null) {
            if (avgResponseMinutes < 60) {
                avgResponseFormatted = `${avgResponseMinutes} min`;
            } else {
                const h = Math.floor(avgResponseMinutes / 60);
                const m = avgResponseMinutes % 60;
                avgResponseFormatted = `${h}h ${m}min`;
            }
        }

        // ─── 4. Best sending slots ──────────────────────────
        // Group outbound by hour, count read rate per hour

        const hourlyStats: Record<number, { sent: number; read: number }> = {};
        for (let h = 0; h < 24; h++) hourlyStats[h] = { sent: 0, read: 0 };

        for (const msg of outbound) {
            const hour = new Date(msg.createdAt).getHours();
            hourlyStats[hour].sent++;
            if (msg.status === 'READ') hourlyStats[hour].read++;
        }

        const bestSlots = Object.entries(hourlyStats)
            .map(([hour, s]) => ({
                hour: parseInt(hour),
                label: `${hour.padStart(2, '0')}h`,
                sent: s.sent,
                read: s.read,
                readRate: s.sent > 0 ? Math.round((s.read / s.sent) * 100) : 0,
            }))
            .sort((a, b) => b.readRate - a.readRate);

        // ─── 5. Daily trend ─────────────────────────────────

        const dailyMap: Record<string, { outbound: number; inbound: number; delivered: number; read: number; failed: number }> = {};

        for (const msg of outbound) {
            const day = new Date(msg.createdAt).toISOString().split('T')[0];
            if (!dailyMap[day]) dailyMap[day] = { outbound: 0, inbound: 0, delivered: 0, read: 0, failed: 0 };
            dailyMap[day].outbound++;
            if (['DELIVERED', 'READ'].includes(msg.status)) dailyMap[day].delivered++;
            if (msg.status === 'READ') dailyMap[day].read++;
            if (msg.status === 'FAILED') dailyMap[day].failed++;
        }

        for (const msg of inbound) {
            const day = new Date(msg.createdAt).toISOString().split('T')[0];
            if (!dailyMap[day]) dailyMap[day] = { outbound: 0, inbound: 0, delivered: 0, read: 0, failed: 0 };
            dailyMap[day].inbound++;
        }

        const dailyTrend = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, stats]) => ({ date, ...stats }));

        // ─── 6. Cost estimation ─────────────────────────────
        // Meta WhatsApp pricing (approx):
        // - Utility (templates notification) : ~0.00€ (first 1000/month free, then ~0.0050€)
        // - Marketing (promotional templates) : ~0.0140€ per message
        // - Service (24h window) : gratuit

        const templateMessages = outbound.filter((m: any) => m.templateKey).length;
        const freeformMessages = outbound.filter((m: any) => !m.templateKey).length;

        // Estimate: template = potentially marketing, freeform = service (free in 24h window)
        const estimatedCostUtility = Math.max(0, templateMessages - 1000) * 0.005;
        const estimatedCostMarketing = templateMessages * 0.014; // Worst case
        const estimatedCostBest = estimatedCostUtility; // All utility
        const estimatedCostWorst = estimatedCostMarketing; // All marketing

        // ─── 7. Broadcasts summary ──────────────────────────

        const broadcasts = await (prisma as any).broadcast.findMany({
            where: { organizationId: orgId, createdAt: { gte: since } },
            select: {
                id: true, name: true, status: true,
                totalRecipients: true, sentCount: true, deliveredCount: true, failedCount: true,
                startedAt: true, completedAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        return NextResponse.json({
            period: { days, since: since.toISOString() },
            kpi: {
                totalOutbound,
                totalInbound: inbound.length,
                delivered,
                read,
                failed,
                deliveryRate,
                readRate,
                failRate,
                responseRate,
                uniqueContacts: outboundPhones.size,
                respondedContacts: respondedPhones.length,
                avgResponseMinutes,
                avgResponseFormatted,
            },
            hourlyStats: bestSlots,
            dailyTrend,
            cost: {
                templateMessages,
                freeformMessages,
                estimatedCostBest: Math.round(estimatedCostBest * 100) / 100,
                estimatedCostWorst: Math.round(estimatedCostWorst * 100) / 100,
                note: 'Utility: ~0.005€/msg (1000 gratuits/mois). Marketing: ~0.014€/msg. Service (24h): gratuit.',
            },
            broadcasts,
        });
    } catch (error) {
        console.error('Erreur GET /api/messaging/analytics:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
