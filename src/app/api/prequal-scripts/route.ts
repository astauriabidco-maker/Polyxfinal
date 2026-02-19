import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/prequal-scripts
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const scripts = await prisma.prequalScript.findMany({
            where: { organizationId: session.user.organizationId, isActive: true },
            orderBy: { ordre: 'asc' },
        });

        return NextResponse.json(scripts);
    } catch (error) {
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

// POST /api/prequal-scripts (Add question)
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { question } = await request.json();
        if (!question) return NextResponse.json({ error: 'Question required' }, { status: 400 });

        const count = await prisma.prequalScript.count({ where: { organizationId: session.user.organizationId } });

        const script = await prisma.prequalScript.create({
            data: {
                organizationId: session.user.organizationId,
                question,
                ordre: count + 1,
            },
        });

        return NextResponse.json(script);
    } catch (error) {
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

// PUT /api/prequal-scripts (Update/Reorder)
export async function PUT(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, question, isActive, ordre } = await request.json();

        // Simple update
        const script = await prisma.prequalScript.update({
            where: { id },
            data: {
                ...(question && { question }),
                ...(isActive !== undefined && { isActive }),
                ...(ordre !== undefined && { ordre }),
            },
        });

        return NextResponse.json(script);
    } catch (error) {
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
