/**
 * API BPF — Bilan Pédagogique et Financier
 * ==========================================
 * GET /api/compliance/bpf             — Générer le BPF (JSON)
 * GET /api/compliance/bpf?format=text — Export texte (Cerfa 10443)
 * GET /api/compliance/bpf?exercice=2025 — BPF pour une année spécifique
 * 
 * Protégé : ADMIN et RESP_ADMIN uniquement.
 * 
 * @Compliance: Code du travail Art. L.6352-11, R.6352-22
 * @Audit: DRIEETS
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateBPF, generateBPFTextExport } from '@/lib/compliance/bpf';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { organizationId, role: roleObj, nom, prenom } = session.user;
        const role = typeof roleObj === 'string' ? roleObj : (roleObj as any)?.code || 'UNKNOWN';

        // RBAC : ADMIN ou RESP_ADMIN uniquement
        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json(
                {
                    error: 'Accès restreint',
                    message: 'Seuls les rôles ADMIN et RESP_ADMIN peuvent générer le BPF.',
                },
                { status: 403 },
            );
        }

        const { searchParams } = new URL(req.url);
        const exercice = searchParams.get('exercice')
            ? parseInt(searchParams.get('exercice')!, 10)
            : undefined;
        const format = searchParams.get('format') || 'json';

        const userName = `${prenom || ''} ${nom || ''}`.trim() || 'Système';

        console.log(`[BPF] 📊 Génération BPF exercice ${exercice || 'année précédente'} par ${userName}`);

        const report = await generateBPF(organizationId, exercice, userName);

        // Export texte pour impression / archivage
        if (format === 'text') {
            const textContent = generateBPFTextExport(report);
            const fileName = `BPF-${report.metadata.exercice}-${report.identification.raisonSociale.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;

            return new NextResponse(textContent, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${fileName}"`,
                },
            });
        }

        return NextResponse.json({
            success: true,
            report,
        });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[BPF API] Error:', errMsg, error);
        return NextResponse.json({ error: 'Erreur serveur', details: errMsg }, { status: 500 });
    }
}
