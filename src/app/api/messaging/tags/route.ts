/**
 * TAGS CRUD — Contact Tags for Segmentation
 * ============================================
 * GET    — List all tags (with counts) for the organization
 * POST   — Add a tag to a lead
 * DELETE — Remove a tag from a lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        // All unique tags with counts
        const tags = await (prisma as any).contactTag.groupBy({
            by: ['tag'],
            where: { organizationId: session.user.organizationId },
            _count: true,
            orderBy: { _count: { tag: 'desc' } },
        });

        return NextResponse.json({
            tags: tags.map((t: any) => ({ tag: t.tag, count: t._count })),
        });
    } catch (error) {
        console.error('Erreur GET /api/messaging/tags:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();
        const { leadId, tag, leadIds } = body;

        if (!tag) {
            return NextResponse.json({ error: 'tag requis' }, { status: 400 });
        }

        const normalizedTag = tag.trim().toLowerCase();

        // Bulk tag: apply to multiple leads
        if (leadIds?.length) {
            const data = leadIds.map((lid: string) => ({
                organizationId: session.user.organizationId!,
                leadId: lid,
                tag: normalizedTag,
            }));

            await (prisma as any).contactTag.createMany({
                data,
                skipDuplicates: true,
            });

            return NextResponse.json({ success: true, tagged: leadIds.length });
        }

        // Single tag
        if (!leadId) {
            return NextResponse.json({ error: 'leadId ou leadIds requis' }, { status: 400 });
        }

        await (prisma as any).contactTag.upsert({
            where: {
                organizationId_leadId_tag: {
                    organizationId: session.user.organizationId,
                    leadId,
                    tag: normalizedTag,
                },
            },
            create: {
                organizationId: session.user.organizationId,
                leadId,
                tag: normalizedTag,
            },
            update: {},
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur POST /api/messaging/tags:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const tag = searchParams.get('tag');
        const leadId = searchParams.get('leadId');

        if (!tag) {
            return NextResponse.json({ error: 'tag requis' }, { status: 400 });
        }

        if (leadId) {
            // Remove tag from specific lead
            await (prisma as any).contactTag.deleteMany({
                where: {
                    organizationId: session.user.organizationId,
                    leadId,
                    tag,
                },
            });
        } else {
            // Remove tag from all leads
            await (prisma as any).contactTag.deleteMany({
                where: {
                    organizationId: session.user.organizationId,
                    tag,
                },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erreur DELETE /api/messaging/tags:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
