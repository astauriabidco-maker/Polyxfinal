/**
 * API REGISTRE DES TRAITEMENTS — Article 30 RGPD
 * =================================================
 * GET  /api/rgpd/registre       — Récupérer le registre complet
 * GET  /api/rgpd/registre?stats — Récupérer les statistiques uniquement
 * 
 * Protégé par RBAC : ADMIN et RESP_ADMIN uniquement.
 * 
 * @Compliance: RGPD Art. 30
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateRegister, getRegisterStats } from '@/lib/prospection/rgpd-register';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { organizationId, role: roleObj } = session.user;
        const role = typeof roleObj === 'string' ? roleObj : (roleObj as any)?.code || 'UNKNOWN';

        // RBAC : ADMIN ou RESP_ADMIN uniquement
        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json(
                {
                    error: 'Accès restreint',
                    message: 'Seuls les rôles ADMIN et RESP_ADMIN peuvent consulter le registre des traitements.',
                },
                { status: 403 },
            );
        }

        const { searchParams } = new URL(req.url);
        const statsOnly = searchParams.has('stats');
        const format = searchParams.get('format') || 'json';

        // Mode stats uniquement (pour le dashboard)
        if (statsOnly) {
            const stats = await getRegisterStats(organizationId);
            return NextResponse.json({
                success: true,
                stats,
            });
        }

        // Registre complet
        const register = await generateRegister(organizationId);

        // Export texte pour téléchargement
        if (format === 'text') {
            const textContent = generateTextExport(register);
            return new NextResponse(textContent, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Content-Disposition': `attachment; filename="registre-traitements-art30-${new Date().toISOString().split('T')[0]}.txt"`,
                },
            });
        }

        return NextResponse.json({
            success: true,
            register,
        });
    } catch (error) {
        console.error('[RGPD Register API] Error:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * Génère un export texte lisible du registre (pour impression / archivage).
 */
function generateTextExport(register: ReturnType<typeof generateRegister> extends Promise<infer T> ? T : never): string {
    const sep = '═'.repeat(80);
    const thin = '─'.repeat(80);
    const lines: string[] = [];

    lines.push(sep);
    lines.push('  REGISTRE DES ACTIVITÉS DE TRAITEMENT — Article 30 RGPD');
    lines.push(sep);
    lines.push('');
    lines.push(`  Organisation : ${register.metadata.organizationName}`);
    lines.push(`  Date         : ${new Date(register.generatedAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    lines.push(`  Version      : ${register.version}`);
    lines.push(`  Réf. CNIL    : ${register.metadata.cnilReference}`);
    lines.push(`  Généré par   : ${register.metadata.generatedBy}`);
    lines.push('');

    // Responsable de traitement
    lines.push(thin);
    lines.push('  RESPONSABLE DE TRAITEMENT');
    lines.push(thin);
    lines.push(`  Nom        : ${register.controller.name}`);
    lines.push(`  Adresse    : ${register.controller.address}`);
    lines.push(`  Représentant: ${register.controller.representant}`);
    lines.push(`  Contact    : ${register.controller.contactEmail}`);
    if (register.controller.siret) {
        lines.push(`  SIRET      : ${register.controller.siret}`);
    }
    lines.push('');

    // DPO
    lines.push(thin);
    lines.push('  DÉLÉGUÉ À LA PROTECTION DES DONNÉES (DPO)');
    lines.push(thin);
    if (register.dpo.designated) {
        lines.push(`  Nom   : ${register.dpo.name || 'Non renseigné'}`);
        lines.push(`  Email : ${register.dpo.email || 'Non renseigné'}`);
        lines.push(`  Tél.  : ${register.dpo.phone || 'Non renseigné'}`);
    } else {
        lines.push('  ⚠️  Aucun DPO désigné. La désignation est obligatoire pour les');
        lines.push('       organismes traitant des données à grande échelle (Art. 37).');
    }
    lines.push('');

    // Traitements
    for (const t of register.treatments) {
        lines.push(sep);
        lines.push(`  TRAITEMENT ${t.id} : ${t.name}`);
        lines.push(sep);
        lines.push('');
        lines.push(`  Description : ${t.description}`);
        lines.push(`  Statut      : ${t.status}`);
        lines.push('');

        lines.push('  FINALITÉS :');
        for (const p of t.purpose) {
            lines.push(`    • ${p}`);
        }
        lines.push('');

        lines.push('  BASE LÉGALE :');
        lines.push(`    ${t.legalBasis}`);
        lines.push(`    ${t.legalBasisDetail}`);
        lines.push('');

        lines.push('  CATÉGORIES DE DONNÉES :');
        for (const cat of t.dataCategories) {
            lines.push(`    ▸ ${cat.category} [${cat.sensitivity}]`);
            lines.push(`      Champs : ${cat.fields.join(', ')}`);
        }
        lines.push('');

        lines.push('  PERSONNES CONCERNÉES :');
        for (const pc of t.dataConcernedPersons) {
            lines.push(`    • ${pc}`);
        }
        lines.push('');

        lines.push('  DESTINATAIRES :');
        for (const r of t.recipients) {
            const dpa = r.dpaStatus !== 'NOT_REQUIRED' ? ` [DPA: ${r.dpaStatus}]` : '';
            lines.push(`    • ${r.name} (${r.type}) — ${r.country}${dpa}`);
        }
        lines.push('');

        lines.push('  DURÉE DE CONSERVATION :');
        lines.push(`    ${t.retentionPeriod}`);
        lines.push(`    ${t.retentionDetail}`);
        lines.push('');

        lines.push('  MESURES DE SÉCURITÉ :');
        for (const m of t.securityMeasures) {
            lines.push(`    ✓ ${m}`);
        }
        lines.push('');

        if (t.transfersOutsideEU.length > 0) {
            lines.push('  TRANSFERTS HORS UE :');
            for (const tr of t.transfersOutsideEU) {
                lines.push(`    → ${tr.country} — ${tr.recipient} (${tr.mechanism})`);
            }
        } else {
            lines.push('  TRANSFERTS HORS UE : Aucun');
        }
        lines.push('');

        lines.push(`  AIPD (DPIA) : ${t.dpia.required ? (t.dpia.completed ? 'Réalisée' : '⚠️ Requise mais non réalisée') : 'Non requise'}`);
        lines.push(`  Dernière revue : ${t.lastReviewDate}`);
        lines.push('');
    }

    lines.push(sep);
    lines.push('  FIN DU REGISTRE');
    lines.push(`  Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`);
    lines.push(sep);

    return lines.join('\n');
}
