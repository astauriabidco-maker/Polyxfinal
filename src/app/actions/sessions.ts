
'use server';

import { prisma } from '@/lib/prisma';
import { SessionInput, SessionSchema } from '@/lib/catalogue/session-schema';
import { StagiaireInput, StagiaireSchema } from '@/lib/catalogue/dossier-schema';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

export async function createSession(data: SessionInput) {
    const session = await auth();
    if (!session?.user?.organizationId) throw new Error("Unauthorized");

    const validated = SessionSchema.parse(data);

    // Generate Reference: S-YYYYMMDD-RND
    const dateStr = validated.dateDebut.split('-').join('');
    const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const reference = `S-${dateStr}-${rnd}`; // Unique enough per org

    await prisma.session.create({
        data: {
            organizationId: session.user.organizationId,
            programmeId: validated.programmeId,
            reference,
            dateDebut: new Date(validated.dateDebut),
            dateFin: new Date(validated.dateFin),
            siteId: validated.siteId,
            formateurId: validated.formateurId || null,
            placesMin: validated.placesMin,
            placesMax: validated.placesMax,
            status: validated.status,
            planningJson: validated.planningJson ?? {},
        }
    });

    revalidatePath(`/catalogue/${validated.programmeId}`);
}

export async function getSessionsForProgram(programmeId: string) {
    const session = await auth();
    if (!session?.user?.organizationId) return [];

    return prisma.session.findMany({
        where: {
            programmeId,
            organizationId: session.user.organizationId
        },
        include: {
            site: true,
            formateur: true,
            _count: { select: { dossiers: true } }
        },
        orderBy: { dateDebut: 'asc' }
    });
}


export async function getSessionDetails(sessionId: string) {
    const session = await auth();
    if (!session?.user?.organizationId) return null;

    const data = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
            programme: true,
            site: true,
            formateur: true,
            dossiers: {
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    stagiaireNom: true,
                    stagiairePrenom: true,
                    stagiaireEmail: true,
                    status: true,
                    dateInscription: true,
                    company: { select: { raisonSociale: true } }
                }
            },
            _count: { select: { dossiers: true } }
        }
    });

    if (data?.organizationId !== session.user.organizationId) return null;
    return data;
}

export async function registerStagiaire(sessionId: string, data: StagiaireInput) {
    const session = await auth();
    const orgId = session?.user?.organizationId;
    if (!session?.user || !orgId) throw new Error('Unauthorized');

    // Validate input
    const validated = StagiaireSchema.parse(data);

    // Check session & capacity
    const currentSession = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { _count: { select: { dossiers: true } } }
    });

    if (!currentSession) throw new Error('Session not found');
    if (currentSession.organizationId !== orgId) throw new Error('Unauthorized');

    if (currentSession._count.dossiers >= currentSession.placesMax) {
        throw new Error('Session complète (capacité maximale atteinte)');
    }

    // Check duplicate email in this session? (Optional but good practice)
    const existing = await prisma.dossier.findFirst({
        where: { sessionId, stagiaireEmail: validated.email }
    });
    if (existing) throw new Error('Ce stagiaire est déjà inscrit à cette session.');

    // Create Dossier
    await prisma.dossier.create({
        data: {
            sessionId,
            organizationId: orgId,
            siteId: currentSession.siteId,
            stagiaireNom: validated.nom,
            stagiairePrenom: validated.prenom,
            stagiaireEmail: validated.email,
            stagiaireTelephone: validated.telephone || null,
            status: 'BROUILLON',
            createdById: session.user.id,
            source: 'ORGANIC',
            phaseActuelle: 1,
            // companyId is optional for now
        }
    });

    revalidatePath(`/catalogue/${currentSession.programmeId}`);
    revalidatePath(`/catalogue/${currentSession.programmeId}/sessions/${sessionId}`);
}

export async function getSites() {
    const session = await auth();
    if (!session?.user?.organizationId) return [];
    return prisma.site.findMany({
        where: { organizationId: session.user.organizationId, isActive: true }
    });
}

export async function getTrainers() {
    const session = await auth();
    if (!session?.user?.organizationId) return [];
    // Users who are members of this organization
    return prisma.user.findMany({
        where: {
            memberships: {
                some: { organizationId: session.user.organizationId }
            }
        },
        orderBy: { nom: 'asc' }
    });
}
