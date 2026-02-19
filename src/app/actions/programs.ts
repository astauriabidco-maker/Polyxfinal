'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { ProgramSchema } from '@/lib/catalogue/schema';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Modalite, PhaseStatus } from '@prisma/client';

export type ProgramCreateInput = z.infer<typeof ProgramSchema> & {
    organizationId?: string; // Optional if derived from session
    originalTemplateId?: string; // If creating a copy (manual)
};

export async function createProgram(data: ProgramCreateInput) {
    const session = await auth();
    if (!session?.user?.organizationId) {
        throw new Error('Unauthorized: No organization found');
    }

    // Validate with Zod
    const validation = ProgramSchema.safeParse(data);
    if (!validation.success) {
        throw new Error('Validation failed: ' + validation.error.message);
    }

    const validatedData = validation.data;
    const orgId = session.user.organizationId;

    // Create Program
    const program = await prisma.programme.create({
        data: {
            organizationId: orgId,
            reference: validatedData.reference,
            title: validatedData.title,
            isTemplate: validatedData.isTemplate,
            publicCible: validatedData.publicCible,
            prerequis: validatedData.prerequis,
            objectifs: validatedData.objectifs, // Already string[]
            dureeHeures: validatedData.dureeHeures,
            dureeJours: validatedData.dureeJours,
            modalite: validatedData.modalite,
            contenu: validatedData.contenu ?? {},
            moyensPedago: validatedData.moyensPedago,
            modalitesEval: validatedData.modalitesEval,
            tarifInter: validatedData.tarifInter,
            tarifIntra: validatedData.tarifIntra,
            isPublished: validatedData.isPublished,
            status: validatedData.status,
            // Backward compat
            tarifHT: validatedData.tarifInter ? validatedData.tarifInter : 0,
            tarifTTC: validatedData.tarifInter ? validatedData.tarifInter * 1.2 : 0,
        }
    });

    // Replicate Logic (Master Catalog)
    if (validatedData.isTemplate && validatedData.isPublished) {
        await publishToNetwork(program.id);
    }

    revalidatePath('/catalogue');
    return program;
}

export async function publishToNetwork(programId: string) {
    // 1. Get the source program
    const sourceProgram = await prisma.programme.findUnique({
        where: { id: programId },
        include: { organization: true }
    });

    if (!sourceProgram) throw new Error('Program not found');
    if (!sourceProgram.isTemplate) throw new Error('Program is not a template');

    // 2. Find all child organizations (franchisees)
    const franchisees = await prisma.organization.findMany({
        where: { parentId: sourceProgram.organizationId }
    });

    console.log(`[MasterCatalog] Publishing program ${sourceProgram.reference} to ${franchisees.length} franchisees...`);

    // 3. For each franchisee, create or update a copy
    for (const franchise of franchisees) {
        // Check if copy exists
        const existingCopy = await prisma.programme.findFirst({
            where: {
                organizationId: franchise.id,
                originalTemplateId: sourceProgram.id
            }
        });

        if (existingCopy) {
            // Update critical fields (sync with master)
            await prisma.programme.update({
                where: { id: existingCopy.id },
                data: {
                    title: sourceProgram.title, // Sync title
                    objectifs: sourceProgram.objectifs, // Sync objectives (Qualiopi lock)
                    contenu: sourceProgram.contenu ?? {}, // Sync content
                    // Franchisee can keep their own pricing/schedule if we don't update them here
                    // But typically Master updates core pedagogy
                    isPublished: true, // Re-publish if master updates? Maybe optional.
                }
            });
        } else {
            // Create new copy linked to master
            await prisma.programme.create({
                data: {
                    organizationId: franchise.id,
                    originalTemplateId: sourceProgram.id,
                    reference: sourceProgram.reference, // Same ref? Or maybe tailored? Assuming same ref is ok if unique per org.
                    title: sourceProgram.title,
                    isTemplate: false, // Copy is not a template itself (unless it becomes one for sub-franchise?)
                    publicCible: sourceProgram.publicCible,
                    prerequis: sourceProgram.prerequis,
                    objectifs: sourceProgram.objectifs,
                    dureeHeures: sourceProgram.dureeHeures,
                    dureeJours: sourceProgram.dureeJours,
                    modalite: sourceProgram.modalite,
                    contenu: sourceProgram.contenu ?? {},
                    moyensPedago: sourceProgram.moyensPedago,
                    modalitesEval: sourceProgram.modalitesEval,
                    tarifInter: sourceProgram.tarifInter, // Suggest master price
                    tarifIntra: sourceProgram.tarifIntra, // Suggest master price
                    isPublished: true,
                    status: PhaseStatus.ACTIF,
                    // Compat
                    tarifHT: sourceProgram.tarifHT,
                    tarifTTC: sourceProgram.tarifTTC,
                }
            });
        }
    }

    return { success: true, count: franchisees.length };
}

export async function getPrograms() {
    const session = await auth();
    console.log("[DEBUG] getPrograms - User:", session?.user?.email, "OrgId:", session?.user?.organizationId);

    // If no org selected, try to fetch all (DEBUG / ADMIN View)
    // In production, this should check for SUPER_ADMIN role
    const whereClause = session?.user?.organizationId
        ? { organizationId: session.user.organizationId }
        : {}; // Fetch all if no org

    return await prisma.programme.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
            originalTemplate: {
                select: {
                    organization: { select: { name: true } } // To show "Source: Siège National"
                }
            }
        }
    });
}

export async function updateProgram(id: string, data: ProgramCreateInput) {
    const session = await auth();
    if (!session?.user?.organizationId) {
        throw new Error('Unauthorized');
    }

    const validation = ProgramSchema.safeParse(data);
    if (!validation.success) {
        throw new Error('Validation failed: ' + validation.error.message);
    }
    const validatedData = validation.data;

    const existing = await prisma.programme.findUnique({
        where: { id },
        select: { organizationId: true }
    });

    if (!existing || existing.organizationId !== session.user.organizationId) {
        throw new Error('Unauthorized or Not Found');
    }

    const updated = await prisma.programme.update({
        where: { id },
        data: {
            reference: validatedData.reference,
            title: validatedData.title,
            isTemplate: validatedData.isTemplate,
            publicCible: validatedData.publicCible,
            prerequis: validatedData.prerequis,
            objectifs: validatedData.objectifs,
            dureeHeures: validatedData.dureeHeures,
            dureeJours: validatedData.dureeJours,
            modalite: validatedData.modalite,
            contenu: validatedData.contenu ?? {},
            moyensPedago: validatedData.moyensPedago,
            modalitesEval: validatedData.modalitesEval,
            tarifInter: validatedData.tarifInter,
            tarifIntra: validatedData.tarifIntra,
            isPublished: validatedData.isPublished,
            status: validatedData.status,
            tarifHT: validatedData.tarifInter ? validatedData.tarifInter : 0,
            tarifTTC: validatedData.tarifInter ? validatedData.tarifInter * 1.2 : 0,
        } as any
    });

    revalidatePath(`/catalogue/${id}`);
    revalidatePath('/catalogue');
    return updated;
}
