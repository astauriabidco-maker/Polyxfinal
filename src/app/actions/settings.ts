'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

export async function saveAISettings(data: { provider: string; model?: string; apiKey?: string }) {
    const session = await auth();
    const orgId = session?.user?.organizationId;

    if (!orgId) throw new Error("Non autorisé");

    await prisma.aISettings.upsert({
        where: { organizationId: orgId },
        update: {
            provider: data.provider,
            model: data.model || null,
            apiKey: data.apiKey || null
        },
        create: {
            organizationId: orgId,
            provider: data.provider,
            model: data.model || null,
            apiKey: data.apiKey || null
        }
    });

    revalidatePath('/settings/ai');
    return { success: true };
}

export async function getAISettings() {
    const session = await auth();
    const orgId = session?.user?.organizationId;

    if (!orgId) return null;

    return prisma.aISettings.findUnique({
        where: { organizationId: orgId }
    });
}
