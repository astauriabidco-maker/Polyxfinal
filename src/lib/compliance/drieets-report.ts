/**
 * SERVICE RAPPORT ANNUEL DRIEETS
 * ================================================================
 * Rapport d'activité annuel destiné à la Direction Régionale
 * de l'Économie, de l'Emploi, du Travail et des Solidarités.
 * 
 * Ce rapport complète le BPF (Cerfa 10443) en ajoutant :
 *   - Vue d'ensemble de l'organisme et ses sites
 *   - Effectifs formateurs et administratifs
 *   - Tableau de bord qualité (réclamations, compliance alerts)
 *   - Checklist réglementaire (documents obligatoires)
 *   - Indicateurs de performance pédagogique détaillés
 * 
 * @Compliance: Code du travail L.6351-1, L.6352-1 à L.6352-13
 * @Compliance: Qualiopi — Indicateurs 1 à 32
 */

import { prisma as defaultPrisma } from '@/lib/prisma';
import { generateBPF, type BPFReport } from './bpf';

// ─── DI Pattern ───────────────────────────────────────────────

let prismaInstance: any = null;

export function setPrismaInstance(instance: any): void {
    prismaInstance = instance;
}

function getPrisma(): any {
    return prismaInstance || defaultPrisma;
}

// ─── Types ────────────────────────────────────────────────────

/** Vue d'un site de formation */
export interface SiteInfo {
    id: string;
    name: string;
    city: string;
    zipCode: string;
    isHeadquarters: boolean;
    uaiCode: string | null;
    isActive: boolean;
    nbSessions: number;
    nbDossiers: number;
}

/** Effectifs de l'organisme */
export interface EffectifInfo {
    totalMembres: number;
    parRole: Record<string, number>;
    formateurs: {
        id: string;
        nom: string;
        prenom: string;
        email: string;
        nbSessionsAnimees: number;
    }[];
}

/** Qualité et réclamations */
export interface QualiteInfo {
    totalReclamations: number;
    reclamationsResolues: number;
    reclamationsEnCours: number;
    tauxResolution: number;
    complianceAlerts: {
        total: number;
        resolved: number;
        unresolved: number;
        bySeverity: Record<string, number>;
        byRule: { ruleId: string; count: number }[];
    };
    auditActions: {
        total: number;
        byAction: Record<string, number>;
        forcages: number;
    };
}

/** Checklist réglementaire */
export interface ChecklistItem {
    label: string;
    reference: string;
    status: 'OK' | 'KO' | 'PARTIEL' | 'NA';
    detail: string;
}

/** Catalogue de formation */
export interface CatalogueItem {
    id: string;
    reference: string;
    intitule: string;
    dureeHeures: number;
    modalite: string;
    tarifHT: number;
    certificationCode: string | null;
    isPublished: boolean;
    nbSessionsRealisees: number;
}

/** Rapport annuel complet DRIEETS */
export interface DRIEETSReport {
    metadata: {
        exercice: number;
        periodeDebut: string;
        periodeFin: string;
        organizationId: string;
        generatedAt: string;
        generatedBy: string;
        version: string;
    };
    bpf: BPFReport;
    sites: SiteInfo[];
    effectifs: EffectifInfo;
    catalogue: CatalogueItem[];
    qualite: QualiteInfo;
    checklist: ChecklistItem[];
    synthese: {
        pointsForts: string[];
        pointsVigilance: string[];
        recommandations: string[];
    };
}

// ─── Service principal ───────────────────────────────────────

/**
 * Génère le rapport annuel DRIEETS complet.
 * Intègre le BPF + données enrichies (sites, effectifs, qualité, checklist).
 */
export async function generateDRIEETSReport(
    organizationId: string,
    exercice?: number,
    generatedBy: string = 'Système',
): Promise<DRIEETSReport> {
    const db = getPrisma();
    const year = exercice || new Date().getFullYear() - 1;
    const periodeDebut = new Date(year, 0, 1);
    const periodeFin = new Date(year, 11, 31, 23, 59, 59);

    // ── 1. BPF intégré ────────────────────────────────────────
    const bpf = await generateBPF(organizationId, year, generatedBy);

    // ── 2. Organisation complète ──────────────────────────────
    const org = await db.organization.findUnique({
        where: { id: organizationId },
        include: {
            sites: { where: { isActive: true }, orderBy: { isHeadquarters: 'desc' } },
            members: { include: { user: true } },
            programmes: {
                include: {
                    certification: true,
                    sessions: {
                        where: {
                            OR: [
                                { dateDebut: { gte: periodeDebut, lte: periodeFin } },
                                { dateFin: { gte: periodeDebut, lte: periodeFin } },
                            ],
                        },
                    },
                },
            },
        },
    });

    if (!org) throw new Error(`Organisation introuvable: ${organizationId}`);

    // ── 3. Sites ──────────────────────────────────────────────
    const sessions = await db.session.findMany({
        where: {
            organizationId,
            OR: [
                { dateDebut: { gte: periodeDebut, lte: periodeFin } },
                { dateFin: { gte: periodeDebut, lte: periodeFin } },
            ],
        },
        include: { dossiers: true },
    });

    const sites: SiteInfo[] = org.sites.map((site: any) => {
        const siteSessions = sessions.filter((s: any) => s.siteId === site.id);
        const nbDossiers = siteSessions.reduce(
            (sum: number, s: any) => sum + (s.dossiers?.length || 0), 0,
        );
        return {
            id: site.id,
            name: site.name,
            city: site.city,
            zipCode: site.zipCode,
            isHeadquarters: site.isHeadquarters,
            uaiCode: site.uaiCode,
            isActive: site.isActive,
            nbSessions: siteSessions.length,
            nbDossiers,
        };
    });

    // ── 4. Effectifs ──────────────────────────────────────────
    const parRole: Record<string, number> = {};
    for (const m of org.members) {
        parRole[m.role] = (parRole[m.role] || 0) + 1;
    }

    const formateurIds = org.members
        .filter((m: any) => m.role.code === 'FORMAT')
        .map((m: any) => m.userId);

    const formateursDetails = org.members
        .filter((m: any) => m.role.code === 'FORMAT')
        .map((m: any) => {
            const nbSessionsAnimees = sessions.filter(
                (s: any) => s.formateurId === m.userId,
            ).length;
            return {
                id: m.userId,
                nom: m.user.nom,
                prenom: m.user.prenom,
                email: m.user.email,
                nbSessionsAnimees,
            };
        });

    const effectifs: EffectifInfo = {
        totalMembres: org.members.length,
        parRole,
        formateurs: formateursDetails,
    };

    // ── 5. Catalogue ──────────────────────────────────────────
    const catalogue: CatalogueItem[] = org.programmes.map((prog: any) => ({
        id: prog.id,
        reference: prog.reference,
        intitule: prog.intitule,
        dureeHeures: prog.dureeHeures,
        modalite: prog.modalite,
        tarifHT: prog.tarifHT ? parseFloat(prog.tarifHT.toString()) : 0,
        certificationCode: prog.certification?.code || null,
        isPublished: prog.isPublished,
        nbSessionsRealisees: prog.sessions?.length || 0,
    }));

    // ── 6. Qualité ────────────────────────────────────────────
    const qualite = await computeQualiteInfo(db, organizationId, periodeDebut, periodeFin);

    // ── 7. Checklist réglementaire ────────────────────────────
    const checklist = buildChecklist(org, bpf, sites, effectifs, qualite);

    // ── 8. Synthèse auto ──────────────────────────────────────
    const synthese = buildSynthese(bpf, sites, effectifs, qualite, checklist);

    return {
        metadata: {
            exercice: year,
            periodeDebut: periodeDebut.toISOString(),
            periodeFin: periodeFin.toISOString(),
            organizationId,
            generatedAt: new Date().toISOString(),
            generatedBy,
            version: '1.0.0',
        },
        bpf,
        sites,
        effectifs,
        catalogue,
        qualite,
        checklist,
        synthese,
    };
}

// ─── Qualité ──────────────────────────────────────────────────

async function computeQualiteInfo(
    db: any,
    organizationId: string,
    periodeDebut: Date,
    periodeFin: Date,
): Promise<QualiteInfo> {
    // Réclamations
    const reclamations = await db.reclamation.findMany({
        where: {
            organizationId,
            createdAt: { gte: periodeDebut, lte: periodeFin },
        },
    });

    const totalReclamations = reclamations.length;
    const reclamationsResolues = reclamations.filter(
        (r: any) => r.dateResolution != null,
    ).length;

    // Alertes compliance
    const alerts = await db.complianceAlert.findMany({
        where: {
            dossier: { organizationId },
            createdAt: { gte: periodeDebut, lte: periodeFin },
        },
    });

    const bySeverity: Record<string, number> = {};
    const byRuleMap: Record<string, number> = {};
    for (const a of alerts) {
        bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
        byRuleMap[a.ruleId] = (byRuleMap[a.ruleId] || 0) + 1;
    }

    const byRule = Object.entries(byRuleMap)
        .map(([ruleId, count]) => ({ ruleId, count }))
        .sort((a, b) => b.count - a.count);

    // Audit logs
    const auditLogs = await db.auditLog.findMany({
        where: {
            organizationId,
            timestamp: { gte: periodeDebut, lte: periodeFin },
        },
    });

    const byAction: Record<string, number> = {};
    let forcages = 0;
    for (const log of auditLogs) {
        byAction[log.action] = (byAction[log.action] || 0) + 1;
        if (log.isForced) forcages++;
    }

    return {
        totalReclamations,
        reclamationsResolues,
        reclamationsEnCours: totalReclamations - reclamationsResolues,
        tauxResolution: totalReclamations > 0
            ? Math.round((reclamationsResolues / totalReclamations) * 100)
            : 100,
        complianceAlerts: {
            total: alerts.length,
            resolved: alerts.filter((a: any) => a.isResolved).length,
            unresolved: alerts.filter((a: any) => !a.isResolved).length,
            bySeverity,
            byRule,
        },
        auditActions: {
            total: auditLogs.length,
            byAction,
            forcages,
        },
    };
}

// ─── Checklist réglementaire ──────────────────────────────────

function buildChecklist(
    org: any,
    bpf: BPFReport,
    sites: SiteInfo[],
    effectifs: EffectifInfo,
    qualite: QualiteInfo,
): ChecklistItem[] {
    const items: ChecklistItem[] = [];

    // Identification
    items.push({
        label: 'Numéro de Déclaration d\'Activité (NDA)',
        reference: 'Art. L.6351-1',
        status: org.ndaNumber ? 'OK' : 'KO',
        detail: org.ndaNumber || 'Non renseigné',
    });

    items.push({
        label: 'SIRET valide',
        reference: 'Art. L.6351-1',
        status: /^[0-9]{14}$/.test(org.siret) ? 'OK' : 'KO',
        detail: org.siret,
    });

    items.push({
        label: 'Certification Qualiopi',
        reference: 'Loi n° 2018-771',
        status: org.qualiopiCertified ? 'OK' : 'KO',
        detail: org.qualiopiCertified
            ? `Active${org.qualiopiExpiry ? ` — exp. ${new Date(org.qualiopiExpiry).toLocaleDateString('fr-FR')}` : ''}`
            : 'Non certifié',
    });

    // Documents obligatoires
    items.push({
        label: 'Règlement intérieur',
        reference: 'Art. L.6352-3',
        status: org.reglementInterieurUrl ? 'OK' : 'KO',
        detail: org.reglementInterieurUrl ? 'Document enregistré' : 'Absent',
    });

    items.push({
        label: 'Conditions Générales de Vente (CGV)',
        reference: 'Art. L.6353-8',
        status: org.cgvUrl ? 'OK' : 'KO',
        detail: org.cgvUrl ? 'Document enregistré' : 'Absent',
    });

    items.push({
        label: 'Livret d\'accueil',
        reference: 'Qualiopi Ind. 13',
        status: org.livretAccueilUrl ? 'OK' : 'KO',
        detail: org.livretAccueilUrl ? 'Document enregistré' : 'Absent',
    });

    items.push({
        label: 'Signature / Cachet numérique',
        reference: 'Art. L.6353-1',
        status: (org.signatureUrl || org.cachetUrl) ? 'OK' : 'PARTIEL',
        detail: [
            org.signatureUrl ? 'Signature ✓' : 'Signature ✗',
            org.cachetUrl ? 'Cachet ✓' : 'Cachet ✗',
        ].join(' | '),
    });

    // Infrastructure
    const cfaSites = sites.filter(s => org.type === 'CFA');
    if (org.type === 'CFA') {
        const sitesWithUAI = sites.filter(s => s.uaiCode);
        items.push({
            label: 'Codes UAI des sites CFA',
            reference: 'Art. L.6232-1',
            status: sitesWithUAI.length === sites.length ? 'OK' :
                sitesWithUAI.length > 0 ? 'PARTIEL' : 'KO',
            detail: `${sitesWithUAI.length}/${sites.length} sites avec UAI`,
        });
    }

    // BPF
    items.push({
        label: 'BPF (Bilan Pédagogique et Financier)',
        reference: 'Art. R.6352-22',
        status: bpf.bilanPedagogique.totalStagiaires > 0 ? 'OK' : 'PARTIEL',
        detail: bpf.bilanPedagogique.totalStagiaires > 0
            ? `${bpf.bilanPedagogique.totalStagiaires} stagiaires, ${bpf.bilanFinancier.produitsFormation.caTotal}€ CA`
            : 'Aucune activité de formation',
    });

    // Qualité
    items.push({
        label: 'Traitement des réclamations',
        reference: 'Qualiopi Ind. 31',
        status: qualite.tauxResolution >= 80 ? 'OK' :
            qualite.tauxResolution >= 50 ? 'PARTIEL' : 'KO',
        detail: `Taux de résolution: ${qualite.tauxResolution}% (${qualite.reclamationsResolues}/${qualite.totalReclamations})`,
    });

    items.push({
        label: 'Alertes compliance résolues',
        reference: 'Qualiopi Ind. 32',
        status: qualite.complianceAlerts.unresolved === 0 ? 'OK' :
            qualite.complianceAlerts.unresolved <= 3 ? 'PARTIEL' : 'KO',
        detail: `${qualite.complianceAlerts.resolved}/${qualite.complianceAlerts.total} résolues — ${qualite.complianceAlerts.unresolved} en attente`,
    });

    // Pédagogie
    items.push({
        label: 'Certificats de réalisation',
        reference: 'Art. D.6313-5',
        status: bpf.bilanPedagogique.nbCertificatsGeneres >= bpf.bilanPedagogique.totalStagiaires ? 'OK' :
            bpf.bilanPedagogique.nbCertificatsGeneres > 0 ? 'PARTIEL' : 'KO',
        detail: `${bpf.bilanPedagogique.nbCertificatsGeneres}/${bpf.bilanPedagogique.totalStagiaires} certificats générés`,
    });

    items.push({
        label: 'Assiduité globale',
        reference: 'Qualiopi Ind. 11',
        status: bpf.bilanPedagogique.tauxAssiduiteGlobal >= 80 ? 'OK' :
            bpf.bilanPedagogique.tauxAssiduiteGlobal >= 60 ? 'PARTIEL' : 'KO',
        detail: `Taux d'assiduité: ${bpf.bilanPedagogique.tauxAssiduiteGlobal}%`,
    });

    // Effectifs
    items.push({
        label: 'Responsable pédagogique désigné',
        reference: 'Qualiopi Ind. 21',
        status: effectifs.parRole['RESP_PEDAGO'] ? 'OK' : 'KO',
        detail: effectifs.parRole['RESP_PEDAGO']
            ? `${effectifs.parRole['RESP_PEDAGO']} responsable(s) pédagogique(s)`
            : 'Aucun responsable pédagogique désigné',
    });

    items.push({
        label: 'Référent qualité désigné',
        reference: 'Qualiopi Ind. 32',
        status: effectifs.parRole['REF_QUALITE'] ? 'OK' : 'KO',
        detail: effectifs.parRole['REF_QUALITE']
            ? `${effectifs.parRole['REF_QUALITE']} référent(s) qualité`
            : 'Aucun référent qualité désigné',
    });

    return items;
}

// ─── Synthèse auto ────────────────────────────────────────────

function buildSynthese(
    bpf: BPFReport,
    sites: SiteInfo[],
    effectifs: EffectifInfo,
    qualite: QualiteInfo,
    checklist: ChecklistItem[],
): DRIEETSReport['synthese'] {
    const pointsForts: string[] = [];
    const pointsVigilance: string[] = [];
    const recommandations: string[] = [];

    // Points forts
    const okItems = checklist.filter(c => c.status === 'OK').length;
    const totalItems = checklist.length;
    if (okItems === totalItems) {
        pointsForts.push('Toutes les obligations réglementaires sont satisfaites.');
    } else if (okItems / totalItems >= 0.8) {
        pointsForts.push(`${okItems}/${totalItems} obligations réglementaires validées.`);
    }

    if (bpf.bilanPedagogique.tauxAssiduiteGlobal >= 90) {
        pointsForts.push(`Excellent taux d'assiduité: ${bpf.bilanPedagogique.tauxAssiduiteGlobal}%.`);
    }

    if (bpf.bilanPedagogique.tauxReussite >= 80) {
        pointsForts.push(`Taux de réussite très satisfaisant: ${bpf.bilanPedagogique.tauxReussite}%.`);
    }

    if (qualite.tauxResolution === 100 && qualite.totalReclamations > 0) {
        pointsForts.push('100% des réclamations traitées.');
    }

    if (qualite.complianceAlerts.unresolved === 0) {
        pointsForts.push('Aucune alerte de conformité en attente.');
    }

    if (sites.length > 1) {
        pointsForts.push(`Réseau de ${sites.length} sites de formation actifs.`);
    }

    // Points de vigilance
    const koItems = checklist.filter(c => c.status === 'KO');
    for (const item of koItems) {
        pointsVigilance.push(`❌ ${item.label} (${item.reference}) — ${item.detail}`);
    }

    if (bpf.bilanPedagogique.tauxAssiduiteGlobal < 70 && bpf.bilanPedagogique.tauxAssiduiteGlobal > 0) {
        pointsVigilance.push(`Taux d'assiduité faible: ${bpf.bilanPedagogique.tauxAssiduiteGlobal}%.`);
    }

    if (qualite.auditActions.forcages > 0) {
        pointsVigilance.push(
            `${qualite.auditActions.forcages} action(s) de forçage enregistrée(s) — justification requise.`,
        );
    }

    if (qualite.complianceAlerts.unresolved > 5) {
        pointsVigilance.push(
            `${qualite.complianceAlerts.unresolved} alertes de conformité non résolues.`,
        );
    }

    // Recommandations
    for (const item of koItems) {
        recommandations.push(`Corriger en priorité: ${item.label} (${item.reference}).`);
    }

    const partielItems = checklist.filter(c => c.status === 'PARTIEL');
    for (const item of partielItems) {
        recommandations.push(`Compléter: ${item.label} — actuellement partiel.`);
    }

    if (bpf.bilanPedagogique.totalStagiaires === 0) {
        recommandations.push('Aucun stagiaire actif — le rapport sera vide si transmis à la DRIEETS.');
    }

    if (effectifs.formateurs.length === 0) {
        recommandations.push('Aucun formateur enregistré — vérifier les affectations de rôle.');
    }

    return { pointsForts, pointsVigilance, recommandations };
}

// ─── Export texte ─────────────────────────────────────────────

/**
 * Génère l'export texte du rapport annuel DRIEETS.
 */
export function generateDRIEETSTextExport(report: DRIEETSReport): string {
    const sep = '═'.repeat(80);
    const thin = '─'.repeat(80);
    const lines: string[] = [];

    lines.push(sep);
    lines.push('  RAPPORT ANNUEL D\'ACTIVITÉ — DRIEETS');
    lines.push(`  Exercice ${report.metadata.exercice}`);
    lines.push(`  Organisation: ${report.bpf.identification.raisonSociale}`);
    lines.push(`  SIRET: ${report.bpf.identification.siret}`);
    lines.push(`  NDA: ${report.bpf.identification.ndaNumber || 'Non renseigné'}`);
    lines.push(sep);
    lines.push('');

    // ── 1. Sites ──────────────────────────────────────────────

    lines.push(thin);
    lines.push('  1. SITES DE FORMATION');
    lines.push(thin);
    for (const site of report.sites) {
        const hq = site.isHeadquarters ? ' (Siège)' : '';
        const uai = site.uaiCode ? ` — UAI: ${site.uaiCode}` : '';
        lines.push(`  • ${site.name}${hq} — ${site.zipCode} ${site.city}${uai}`);
        lines.push(`    Sessions: ${site.nbSessions} | Dossiers: ${site.nbDossiers}`);
    }
    lines.push('');

    // ── 2. Effectifs ──────────────────────────────────────────

    lines.push(thin);
    lines.push('  2. EFFECTIFS');
    lines.push(thin);
    lines.push(`  Total collaborateurs: ${report.effectifs.totalMembres}`);
    for (const [role, count] of Object.entries(report.effectifs.parRole)) {
        lines.push(`    ${role}: ${count}`);
    }
    if (report.effectifs.formateurs.length > 0) {
        lines.push('');
        lines.push('  Formateurs:');
        for (const f of report.effectifs.formateurs) {
            lines.push(`    • ${f.prenom} ${f.nom} (${f.email}) — ${f.nbSessionsAnimees} session(s)`);
        }
    }
    lines.push('');

    // ── 3. Catalogue ──────────────────────────────────────────

    lines.push(thin);
    lines.push('  3. CATALOGUE DE FORMATIONS');
    lines.push(thin);
    if (report.catalogue.length > 0) {
        lines.push('');
        lines.push('    ' + 'Réf.'.padEnd(14) + 'Intitulé'.padEnd(30) + 'h'.padStart(5) + 'Tarif HT'.padStart(10) + 'Sessions'.padStart(10));
        lines.push('    ' + '─'.repeat(69));
        for (const prog of report.catalogue) {
            const ref = prog.reference.substring(0, 12).padEnd(14);
            const titre = prog.intitule.substring(0, 28).padEnd(30);
            const h = `${prog.dureeHeures}`.padStart(5);
            const tarif = `${prog.tarifHT}€`.padStart(10);
            const sess = `${prog.nbSessionsRealisees}`.padStart(10);
            lines.push(`    ${ref}${titre}${h}${tarif}${sess}`);
        }
    } else {
        lines.push('    Aucun programme enregistré.');
    }
    lines.push('');

    // ── 4. BPF (résumé) ───────────────────────────────────────

    lines.push(thin);
    lines.push('  4. RÉSUMÉ BPF (voir document détaillé)');
    lines.push(thin);
    const bp = report.bpf.bilanPedagogique;
    const bf = report.bpf.bilanFinancier;
    lines.push(`  Chiffre d'affaires formation    : ${bf.produitsFormation.caTotal.toLocaleString('fr-FR')}€`);
    lines.push(`  Nombre de stagiaires            : ${bp.totalStagiaires}`);
    lines.push(`  Heures dispensées               : ${bp.totalHeuresDispensees}h`);
    lines.push(`  Sessions réalisées              : ${bp.totalSessions}`);
    lines.push(`  Taux d'assiduité                : ${bp.tauxAssiduiteGlobal}%`);
    lines.push(`  Taux de réussite                : ${bp.tauxReussite}%`);
    lines.push(`  Certificats de réalisation      : ${bp.nbCertificatsGeneres}`);
    lines.push('');

    // ── 5. Qualité ────────────────────────────────────────────

    lines.push(thin);
    lines.push('  5. INDICATEURS QUALITÉ');
    lines.push(thin);
    const q = report.qualite;
    lines.push(`  Réclamations reçues             : ${q.totalReclamations}`);
    lines.push(`  Réclamations résolues           : ${q.reclamationsResolues}`);
    lines.push(`  Taux de résolution              : ${q.tauxResolution}%`);
    lines.push(`  Alertes compliance              : ${q.complianceAlerts.total}`);
    lines.push(`    dont résolues                 : ${q.complianceAlerts.resolved}`);
    lines.push(`    dont en attente               : ${q.complianceAlerts.unresolved}`);
    lines.push(`  Actions auditées                : ${q.auditActions.total}`);
    lines.push(`  Actions de forçage              : ${q.auditActions.forcages}`);
    lines.push('');

    // ── 6. Checklist ──────────────────────────────────────────

    lines.push(thin);
    lines.push('  6. CHECKLIST RÉGLEMENTAIRE');
    lines.push(thin);
    for (const item of report.checklist) {
        const icon = item.status === 'OK' ? '✅' :
            item.status === 'PARTIEL' ? '⚠️' :
                item.status === 'KO' ? '❌' : '⬜';
        lines.push(`  ${icon} ${item.label}`);
        lines.push(`     Réf: ${item.reference} — ${item.detail}`);
    }
    lines.push('');

    // ── 7. Synthèse ───────────────────────────────────────────

    lines.push(thin);
    lines.push('  7. SYNTHÈSE ET RECOMMANDATIONS');
    lines.push(thin);

    if (report.synthese.pointsForts.length > 0) {
        lines.push('');
        lines.push('  Points forts:');
        for (const p of report.synthese.pointsForts) lines.push(`    ✅ ${p}`);
    }

    if (report.synthese.pointsVigilance.length > 0) {
        lines.push('');
        lines.push('  Points de vigilance:');
        for (const p of report.synthese.pointsVigilance) lines.push(`    ⚠️ ${p}`);
    }

    if (report.synthese.recommandations.length > 0) {
        lines.push('');
        lines.push('  Recommandations:');
        for (const p of report.synthese.recommandations) lines.push(`    → ${p}`);
    }

    lines.push('');
    lines.push(sep);
    lines.push(`  Rapport généré le ${new Date(report.metadata.generatedAt).toLocaleDateString('fr-FR')} par ${report.metadata.generatedBy}`);
    lines.push(sep);

    return lines.join('\n');
}
