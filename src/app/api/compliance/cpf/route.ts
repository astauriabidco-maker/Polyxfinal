/**
 * API CDC / CPF
 * ===============
 * GET /api/compliance/cpf                        — Récapitulatif CPF (JSON)
 * GET /api/compliance/cpf?format=text             — Export texte
 * GET /api/compliance/cpf?type=eligibilite        — Éligibilité programmes
 * GET /api/compliance/cpf?type=session&id=xxx     — Déclaration EDOF session
 * GET /api/compliance/cpf?exercice=2025           — Année spécifique
 *
 * Protégé : ADMIN et RESP_ADMIN uniquement.
 *
 * @Compliance: Code du travail L.6323-1
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
    generateCPFRecapitulatif,
    generateCPFTextExport,
    checkCPFEligibilite,
    generateEDOFDeclaration,
} from '@/lib/compliance/cpf-export';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { organizationId, role, nom, prenom } = session.user;

        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json(
                { error: 'Accès restreint aux rôles ADMIN et RESP_ADMIN.' },
                { status: 403 },
            );
        }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');
        const format = searchParams.get('format') || 'json';
        const exercice = searchParams.get('exercice')
            ? parseInt(searchParams.get('exercice')!, 10)
            : undefined;
        const userName = `${prenom || ''} ${nom || ''}`.trim() || 'Système';

        // ── Éligibilité des programmes ────────────────────────
        if (type === 'eligibilite') {
            console.log(`[CPF] 🎯 Vérification éligibilité programmes`);
            const eligibilite = await checkCPFEligibilite(organizationId);
            return NextResponse.json({ success: true, eligibilite });
        }

        // ── Déclaration EDOF d'une session ────────────────────
        if (type === 'session') {
            const sessionId = searchParams.get('id');
            if (!sessionId) {
                return NextResponse.json(
                    { error: 'Paramètre id (sessionId) requis pour type=session.' },
                    { status: 400 },
                );
            }
            console.log(`[CPF] 📋 Déclaration EDOF session ${sessionId}`);
            const declaration = await generateEDOFDeclaration(organizationId, sessionId);
            return NextResponse.json({ success: true, declaration });
        }

        // ── Récapitulatif CPF complet ─────────────────────────
        console.log(`[CPF] 📊 Récapitulatif CPF exercice ${exercice || 'courant'}`);
        const recap = await generateCPFRecapitulatif(organizationId, exercice, userName);

        if (format === 'text') {
            const textContent = generateCPFTextExport(recap);
            const fileName = `CPF-${recap.metadata.exercice}-${recap.metadata.organizationName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;

            return new NextResponse(textContent, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${fileName}"`,
                },
            });
        }

        return NextResponse.json({ success: true, recap });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[CPF API] Error:', errMsg, error);
        return NextResponse.json({ error: 'Erreur serveur', details: errMsg }, { status: 500 });
    }
}
