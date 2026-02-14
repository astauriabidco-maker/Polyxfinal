/**
 * API EXPORT DOSSIER OPCO
 * =========================
 * GET /api/compliance/opco                — Liste des contrats OPCO (JSON)
 * GET /api/compliance/opco?sessionId=xxx  — Export dossier d'une session (JSON)
 * GET /api/compliance/opco?sessionId=xxx&format=text — Export texte
 * GET /api/compliance/opco?exercice=2025  — Filtrer par exercice
 *
 * Protégé : ADMIN et RESP_ADMIN uniquement.
 *
 * @Compliance: Code du travail L.6332-1
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
    listOPCOContrats,
    generateOPCOExport,
    generateOPCOTextExport,
} from '@/lib/compliance/opco-export';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { organizationId, role: roleObj, nom, prenom } = session.user;
        const role = typeof roleObj === 'string' ? roleObj : (roleObj as any)?.code || 'UNKNOWN';

        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json(
                { error: 'Accès restreint aux rôles ADMIN et RESP_ADMIN.' },
                { status: 403 },
            );
        }

        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('sessionId');
        const exercice = searchParams.get('exercice')
            ? parseInt(searchParams.get('exercice')!, 10)
            : undefined;
        const format = searchParams.get('format') || 'json';
        const userName = `${prenom || ''} ${nom || ''}`.trim() || 'Système';

        // ── Sans sessionId : lister les contrats OPCO ─────────

        if (!sessionId) {
            console.log(`[OPCO] 📋 Liste contrats OPCO exercice ${exercice || 'courant'}`);
            const contrats = await listOPCOContrats(organizationId, exercice);
            return NextResponse.json({ success: true, ...contrats });
        }

        // ── Avec sessionId : export complet ───────────────────

        console.log(`[OPCO] 📦 Export dossier OPCO session ${sessionId} par ${userName}`);
        const data = await generateOPCOExport(organizationId, sessionId, userName);

        if (format === 'text') {
            const textContent = generateOPCOTextExport(data);
            const fileName = `OPCO-${data.financeur.codeOPCO || 'export'}-${data.sessionInfo.reference}.txt`;

            return new NextResponse(textContent, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${fileName}"`,
                },
            });
        }

        return NextResponse.json({ success: true, export: data });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[OPCO API] Error:', errMsg, error);
        return NextResponse.json({ error: 'Erreur serveur', details: errMsg }, { status: 500 });
    }
}
