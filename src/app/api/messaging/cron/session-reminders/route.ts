/**
 * CRON — Session Reminders & Absence Detection
 * ===============================================
 * POST /api/messaging/cron/session-reminders
 * Daily cron that checks for:
 * - Sessions starting in 7 days (J-7)
 * - Sessions starting in 1 day (J-1)
 * - Sessions ended 1 day ago (J+1)
 * - Emargements with missing signatures > 24h
 * - Absences detected today
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { triggerEvent, AutomationContext } from '@/lib/messaging/automation.service';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
    if (CRON_SECRET) {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const stats = {
        sessionJ7: 0,
        sessionJ1: 0,
        sessionJ1Post: 0,
        absenceDetected: 0,
        signatureMissing: 0,
    };

    try {
        const now = new Date();

        // ─── J-7: Sessions starting in 7 days ────────────────
        const j7Date = new Date(now);
        j7Date.setDate(j7Date.getDate() + 7);
        const j7Start = new Date(j7Date.toDateString());
        const j7End = new Date(j7Start.getTime() + 24 * 60 * 60 * 1000);

        const sessionsJ7 = await prisma.session.findMany({
            where: { dateDebut: { gte: j7Start, lt: j7End } },
            include: {
                dossiers: { where: { status: { in: ['ADMIS', 'CONTRACTUALISE', 'ACTIF'] } } },
                programme: { select: { titre: true } },
                site: { select: { name: true } },
            },
        });

        for (const session of sessionsJ7) {
            for (const dossier of session.dossiers) {
                if (!dossier.stagiaireTelephone) continue;
                const ctx: AutomationContext = {
                    phone: dossier.stagiaireTelephone,
                    dossierId: dossier.id,
                    sessionId: session.id,
                    nom: dossier.stagiaireNom,
                    prenom: dossier.stagiairePrenom,
                    formation: session.programme?.titre || '',
                    dateDebut: session.dateDebut.toLocaleDateString('fr-FR'),
                    dateFin: session.dateFin.toLocaleDateString('fr-FR'),
                    lieuFormation: session.lieuFormation || session.site?.name || '',
                };
                await triggerEvent(session.organizationId, 'SESSION_J7', ctx);
                stats.sessionJ7++;
            }
        }

        // ─── J-1: Sessions starting tomorrow ────────────────
        const j1Date = new Date(now);
        j1Date.setDate(j1Date.getDate() + 1);
        const j1Start = new Date(j1Date.toDateString());
        const j1End = new Date(j1Start.getTime() + 24 * 60 * 60 * 1000);

        const sessionsJ1 = await prisma.session.findMany({
            where: { dateDebut: { gte: j1Start, lt: j1End } },
            include: {
                dossiers: { where: { status: { in: ['ADMIS', 'CONTRACTUALISE', 'ACTIF'] } } },
                programme: { select: { titre: true } },
                site: { select: { name: true } },
            },
        });

        for (const session of sessionsJ1) {
            for (const dossier of session.dossiers) {
                if (!dossier.stagiaireTelephone) continue;
                const ctx: AutomationContext = {
                    phone: dossier.stagiaireTelephone,
                    dossierId: dossier.id,
                    sessionId: session.id,
                    nom: dossier.stagiaireNom,
                    prenom: dossier.stagiairePrenom,
                    formation: session.programme?.titre || '',
                    dateDebut: session.dateDebut.toLocaleDateString('fr-FR'),
                    lieuFormation: session.lieuFormation || session.site?.name || '',
                };
                await triggerEvent(session.organizationId, 'SESSION_J1', ctx);
                stats.sessionJ1++;
            }
        }

        // ─── J+1 Post: Sessions ended yesterday ─────────────
        const jPost1Date = new Date(now);
        jPost1Date.setDate(jPost1Date.getDate() - 1);
        const jPost1Start = new Date(jPost1Date.toDateString());
        const jPost1End = new Date(jPost1Start.getTime() + 24 * 60 * 60 * 1000);

        const sessionsPost = await prisma.session.findMany({
            where: { dateFin: { gte: jPost1Start, lt: jPost1End } },
            include: {
                dossiers: { where: { status: { in: ['ACTIF', 'EN_COURS'] } } },
                programme: { select: { titre: true } },
            },
        });

        for (const session of sessionsPost) {
            for (const dossier of session.dossiers) {
                if (!dossier.stagiaireTelephone) continue;
                const ctx: AutomationContext = {
                    phone: dossier.stagiaireTelephone,
                    dossierId: dossier.id,
                    nom: dossier.stagiaireNom,
                    prenom: dossier.stagiairePrenom,
                    formation: session.programme?.titre || '',
                };
                await triggerEvent(session.organizationId, 'SESSION_J1_POST', ctx);
                stats.sessionJ1Post++;
            }
        }

        // ─── Absences: Emargements without presence today ───
        const todayStart = new Date(now.toDateString());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const absences = await prisma.emargement.findMany({
            where: {
                dateEmargement: { gte: todayStart, lt: todayEnd },
                estPresent: false,
            },
            include: {
                dossier: true,
                session: { include: { programme: { select: { titre: true } } } },
            },
        });

        for (const absence of absences) {
            if (!absence.dossier.stagiaireTelephone) continue;
            const ctx: AutomationContext = {
                phone: absence.dossier.stagiaireTelephone,
                dossierId: absence.dossierId,
                nom: absence.dossier.stagiaireNom,
                prenom: absence.dossier.stagiairePrenom,
                formation: absence.session.programme?.titre || '',
            };
            await triggerEvent(absence.session.organizationId, 'ABSENCE_DETECTED', ctx);
            stats.absenceDetected++;
        }

        // ─── Signature Missing: Unsigned emargements > 24h ──
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const unsignedEmargements = await prisma.emargement.findMany({
            where: {
                estPresent: true,
                signatureStagiaire: null,
                dateEmargement: { lt: yesterday },
                createdAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) }, // Only last 48h
            },
            include: {
                dossier: true,
                session: true,
            },
        });

        for (const emargement of unsignedEmargements) {
            if (!emargement.dossier.stagiaireTelephone) continue;
            const ctx: AutomationContext = {
                phone: emargement.dossier.stagiaireTelephone,
                dossierId: emargement.dossierId,
                nom: emargement.dossier.stagiaireNom,
                prenom: emargement.dossier.stagiairePrenom,
            };
            await triggerEvent(emargement.session.organizationId, 'SIGNATURE_MISSING', ctx);
            stats.signatureMissing++;
        }

        return NextResponse.json({ success: true, stats });
    } catch (error) {
        console.error('Erreur POST /api/messaging/cron/session-reminders:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
