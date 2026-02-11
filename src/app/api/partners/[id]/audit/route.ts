/**
 * API AUDIT PARTENAIRE — Preuves de conformité
 * ===============================================
 * GET /api/partners/[id]/audit              — Historique d'audit
 * GET /api/partners/[id]/audit?type=report  — Rapport de conformité complet
 * GET /api/partners/[id]/audit?format=text  — Export texte (imprimable)
 * 
 * Produit les preuves nécessaires en cas de contrôle :
 *   - Qualiopi Indicateur 17 : traçabilité sous-traitance
 *   - Qualiopi Indicateur 26 : contrôle qualité intervenants
 *   - RGPD Art. 5(2) : responsabilité (accountability)
 *   - RGPD Art. 30 : registre des traitements
 * 
 * Protégé par RBAC : ADMIN et RESP_ADMIN uniquement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
    getPartnerAuditHistory,
    getComplianceReport,
} from '@/lib/prospection/partner-audit';
import {
    computeQualificationScore,
} from '@/lib/prospection/partner-qualification';

// ─── GET Handler ──────────────────────────────────────────────

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const { organizationId, role } = session.user;
        if (!['ADMIN', 'RESP_ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Accès restreint' }, { status: 403 });
        }

        const partnerId = params.id;

        // Vérifier que le partenaire appartient à l'org
        const partner = await prisma.partner.findUnique({
            where: { id: partnerId, organizationId },
            include: { qualification: true },
        });

        if (!partner) {
            return NextResponse.json({ error: 'Partenaire non trouvé' }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'history';
        const format = searchParams.get('format') || 'json';
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        // ── Rapport de conformité complet ─────────────────────
        if (type === 'report') {
            const complianceReport = await getComplianceReport(partnerId);
            const qualification = computeQualificationScore(partner, partner.qualification);
            qualification.partnerId = partnerId;

            const report = {
                generatedAt: new Date().toISOString(),
                generatedBy: `${session.user.prenom || ''} ${session.user.nom || ''}`.trim(),
                organizationId,
                partner: {
                    id: partner.id,
                    companyName: partner.companyName,
                    siret: partner.siret,
                    contactName: partner.contactName,
                    contactEmail: partner.contactEmail,
                    status: partner.status,
                    createdAt: partner.createdAt,
                },
                compliance: complianceReport?.compliance || null,
                qualification: {
                    score: qualification.score,
                    maxScore: qualification.maxScore,
                    grade: qualification.grade,
                    isQualified: qualification.isQualified,
                    conventionStatus: qualification.conventionStatus,
                    details: qualification.details,
                    missingCriteria: qualification.missingCriteria,
                    alerts: qualification.alerts,
                },
                conventionDetails: partner.qualification ? {
                    signedAt: partner.qualification.conventionSignedAt,
                    expiresAt: partner.qualification.conventionExpiresAt,
                    type: partner.qualification.conventionType,
                    url: partner.qualification.conventionUrl,
                } : null,
                documents: partner.qualification ? {
                    hasKbis: partner.qualification.hasKbis,
                    kbisDate: partner.qualification.kbisDate,
                    hasRcPro: partner.qualification.hasRcPro,
                    rcProExpiresAt: partner.qualification.rcProExpiresAt,
                    rcProPolicyNumber: partner.qualification.rcProPolicyNumber,
                    hasUrssaf: partner.qualification.hasUrssaf,
                    urssafDate: partner.qualification.urssafDate,
                    hasReferences: partner.qualification.hasReferences,
                    hasCertifications: partner.qualification.hasCertifications,
                    hasQualityCharter: partner.qualification.hasQualityCharter,
                } : null,
                contractDates: {
                    contractSignedAt: partner.contractSignedAt,
                    contractExpiresAt: partner.contractExpiresAt,
                    dpaSignedAt: partner.dpaSignedAt,
                    ndaSignedAt: partner.ndaSignedAt,
                },
                recentActions: complianceReport?.recentActions || [],
            };

            // Export texte pour impression
            if (format === 'text') {
                const textContent = generateComplianceExport(report);
                return new NextResponse(textContent, {
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Content-Disposition': `attachment; filename="rapport-conformite-${partner.companyName.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.txt"`,
                    },
                });
            }

            return NextResponse.json({ success: true, report });
        }

        // ── Historique d'audit (par défaut) ───────────────────
        const auditHistory = await getPartnerAuditHistory(partnerId, { limit, offset });

        if (format === 'text') {
            const textContent = generateAuditExport(partner.companyName, auditHistory);
            return new NextResponse(textContent, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Content-Disposition': `attachment; filename="audit-${partner.companyName.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.txt"`,
                },
            });
        }

        return NextResponse.json({
            success: true,
            partner: {
                id: partner.id,
                companyName: partner.companyName,
            },
            audit: auditHistory,
        });

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[Partner Audit API] Error:', errMsg, error);
        return NextResponse.json({ error: 'Erreur serveur', details: errMsg }, { status: 500 });
    }
}

// ─── Générateurs d'export texte ───────────────────────────────

function generateComplianceExport(report: any): string {
    const sep = '═'.repeat(80);
    const thin = '─'.repeat(80);
    const lines: string[] = [];

    lines.push(sep);
    lines.push('  RAPPORT DE CONFORMITÉ PARTENAIRE');
    lines.push('  Qualiopi Ind. 17 (Sous-traitance) & Ind. 26 (Intervenants externes)');
    lines.push(sep);
    lines.push('');
    lines.push(`  Partenaire    : ${report.partner.companyName}`);
    lines.push(`  SIRET         : ${report.partner.siret || 'Non renseigné'}`);
    lines.push(`  Contact       : ${report.partner.contactName} (${report.partner.contactEmail})`);
    lines.push(`  Statut        : ${report.partner.status}`);
    lines.push(`  Créé le       : ${new Date(report.partner.createdAt).toLocaleDateString('fr-FR')}`);
    lines.push(`  Rapport généré: ${new Date(report.generatedAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
    lines.push(`  Généré par    : ${report.generatedBy}`);
    lines.push('');

    // Section Qualification
    lines.push(thin);
    lines.push('  QUALIFICATION QUALITÉ (Ind. 26)');
    lines.push(thin);
    lines.push(`  Score       : ${report.qualification.score} / ${report.qualification.maxScore}`);
    lines.push(`  Grade       : ${report.qualification.grade}`);
    lines.push(`  Qualifié    : ${report.qualification.isQualified ? '✅ OUI' : '❌ NON'}`);
    lines.push('');
    lines.push('  Détail des critères :');
    for (const d of report.qualification.details) {
        const status = d.met ? '✅' : '❌';
        lines.push(`    ${status} ${d.label} : ${d.points}/${d.maxPoints} pts [${d.category}]${d.detail ? ` (${d.detail})` : ''}`);
    }
    lines.push('');

    if (report.qualification.missingCriteria.length > 0) {
        lines.push('  ⚠️ Critères manquants :');
        for (const m of report.qualification.missingCriteria) {
            lines.push(`    • ${m}`);
        }
        lines.push('');
    }

    if (report.qualification.alerts.length > 0) {
        lines.push('  🚨 Alertes :');
        for (const a of report.qualification.alerts) {
            lines.push(`    ⚠ ${a}`);
        }
        lines.push('');
    }

    // Section Convention
    lines.push(thin);
    lines.push('  CONVENTION DE SOUS-TRAITANCE (Ind. 17)');
    lines.push(thin);
    lines.push(`  Statut : ${report.qualification.conventionStatus}`);
    if (report.conventionDetails) {
        lines.push(`  Signée le   : ${report.conventionDetails.signedAt ? new Date(report.conventionDetails.signedAt).toLocaleDateString('fr-FR') : 'Non signée'}`);
        lines.push(`  Expire le   : ${report.conventionDetails.expiresAt ? new Date(report.conventionDetails.expiresAt).toLocaleDateString('fr-FR') : 'Non défini'}`);
        lines.push(`  Type        : ${report.conventionDetails.type || 'Non précisé'}`);
        if (report.conventionDetails.url) {
            lines.push(`  Document    : ${report.conventionDetails.url}`);
        }
    } else {
        lines.push('  ⚠️ Aucune convention enregistrée');
    }
    lines.push('');

    // Section Contrats & RGPD
    lines.push(thin);
    lines.push('  CONFORMITÉ CONTRACTUELLE & RGPD');
    lines.push(thin);
    const cd = report.contractDates;
    lines.push(`  Contrat signé      : ${cd.contractSignedAt ? `✅ ${new Date(cd.contractSignedAt).toLocaleDateString('fr-FR')}` : '❌ Non signé'}`);
    lines.push(`  Contrat expire     : ${cd.contractExpiresAt ? new Date(cd.contractExpiresAt).toLocaleDateString('fr-FR') : 'Pas de date d\'expiration'}`);
    lines.push(`  DPA (Art. 28) signé: ${cd.dpaSignedAt ? `✅ ${new Date(cd.dpaSignedAt).toLocaleDateString('fr-FR')}` : '❌ Non signé'}`);
    lines.push(`  NDA signé          : ${cd.ndaSignedAt ? `✅ ${new Date(cd.ndaSignedAt).toLocaleDateString('fr-FR')}` : '— Non requis'}`);
    lines.push('');

    if (report.compliance) {
        lines.push(`  Conformité globale : ${report.compliance.isFullyCompliant ? '✅ CONFORME' : '❌ NON CONFORME'}`);
        lines.push(`  Rejets compliance  : ${report.compliance.totalComplianceRejections}`);
        lines.push('');
    }

    // Section Documents (Ind. 26)
    if (report.documents) {
        lines.push(thin);
        lines.push('  PIÈCES JUSTIFICATIVES (Ind. 26)');
        lines.push(thin);
        const d = report.documents;
        lines.push(`  K-Bis à jour            : ${d.hasKbis ? '✅' : '❌'}${d.kbisDate ? ` (${new Date(d.kbisDate).toLocaleDateString('fr-FR')})` : ''}`);
        lines.push(`  RC Professionnelle       : ${d.hasRcPro ? '✅' : '❌'}${d.rcProPolicyNumber ? ` — Police n° ${d.rcProPolicyNumber}` : ''}${d.rcProExpiresAt ? ` (expire: ${new Date(d.rcProExpiresAt).toLocaleDateString('fr-FR')})` : ''}`);
        lines.push(`  Attestation URSSAF       : ${d.hasUrssaf ? '✅' : '❌'}${d.urssafDate ? ` (${new Date(d.urssafDate).toLocaleDateString('fr-FR')})` : ''}`);
        lines.push(`  Références clients       : ${d.hasReferences ? '✅' : '❌'}`);
        lines.push(`  Certifications/agréments : ${d.hasCertifications ? '✅' : '❌'}`);
        lines.push(`  Charte qualité signée    : ${d.hasQualityCharter ? '✅' : '❌'}`);
        lines.push('');
    }

    // Actions récentes
    if (report.recentActions && report.recentActions.length > 0) {
        lines.push(thin);
        lines.push('  JOURNAL D\'AUDIT — 10 dernières actions');
        lines.push(thin);
        for (const a of report.recentActions) {
            const date = new Date(a.createdAt).toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
            lines.push(`  [${date}] ${a.action}${a.performedByName ? ` par ${a.performedByName}` : ''}`);
            if (a.details) lines.push(`           ${a.details}`);
        }
        lines.push('');
    }

    lines.push(sep);
    lines.push('  Ce document constitue une preuve de conformité pour les audits');
    lines.push('  Qualiopi (Ind. 17 & 26) et les contrôles RGPD.');
    lines.push(`  Généré automatiquement le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`);
    lines.push(sep);

    return lines.join('\n');
}

function generateAuditExport(companyName: string, auditHistory: any): string {
    const sep = '═'.repeat(80);
    const lines: string[] = [];

    lines.push(sep);
    lines.push(`  JOURNAL D'AUDIT — ${companyName}`);
    lines.push(`  Exporté le ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    lines.push(sep);
    lines.push(`  Total actions : ${auditHistory.total}`);
    lines.push('');

    for (const log of auditHistory.logs) {
        const date = new Date(log.createdAt).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        lines.push(`  [${date}] ${log.action}`);
        if (log.performedByName) lines.push(`    Par : ${log.performedByName}`);
        if (log.details) lines.push(`    Détails : ${log.details}`);
        if (log.ipAddress) lines.push(`    IP : ${log.ipAddress}`);
        lines.push('');
    }

    lines.push(sep);
    return lines.join('\n');
}
