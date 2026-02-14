/**
 * API RAPPORT ANNUEL DRIEETS
 * ============================
 * GET /api/compliance/drieets             — Rapport annuel (JSON)
 * GET /api/compliance/drieets?format=text — Export texte
 * GET /api/compliance/drieets?exercice=2025 — Année spécifique
 *
 * Protégé : ADMIN et RESP_ADMIN uniquement.
 *
 * @Compliance: Code du travail L.6352-11
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateDRIEETSReport, generateDRIEETSTextExport } from '@/lib/compliance/drieets-report';

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
        const exercice = searchParams.get('exercice')
            ? parseInt(searchParams.get('exercice')!, 10)
            : undefined;
        const format = searchParams.get('format') || 'json';
        const userName = `${prenom || ''} ${nom || ''}`.trim() || 'Système';

        console.log(`[DRIEETS] 📊 Génération rapport annuel exercice ${exercice || 'N-1'} par ${userName}`);

        const report = await generateDRIEETSReport(organizationId, exercice, userName);

        if (format === 'text') {
            const textContent = generateDRIEETSTextExport(report);
            const fileName = `DRIEETS-${report.metadata.exercice}-${report.bpf.identification.raisonSociale.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;

            return new NextResponse(textContent, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${fileName}"`,
                },
            });
        }

        return NextResponse.json({ success: true, report });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[DRIEETS API] Error:', errMsg, error);
        return NextResponse.json({ error: 'Erreur serveur', details: errMsg }, { status: 500 });
    }
}
