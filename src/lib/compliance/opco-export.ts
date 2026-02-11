/**
 * SERVICE EXPORT DOSSIER OPCO
 * ================================================================
 * Génère un "dossier de financement" complet pour un OPCO.
 *
 * L'OPCO exige un package documentaire structuré pour chaque
 * action de formation financée. Ce service agrège toutes les
 * pièces justificatives requises par dossier/contrat/financeur.
 *
 * Package standard OPCO :
 *   1. Convention de formation (signée)
 *   2. Programme de formation (version contractuelle)
 *   3. Feuilles d'émargement
 *   4. Certificat de réalisation
 *   5. Résultats des évaluations
 *   6. Accord de prise en charge OPCO
 *   7. Récapitulatif financier
 *
 * @Compliance: Code du travail L.6332-1 et suivants
 * @Compliance: Qualiopi Indicateurs 17, 19, 26
 */

import { prisma as defaultPrisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// ─── DI Pattern ───────────────────────────────────────────────

let prismaInstance: any = null;

export function setPrismaInstance(instance: any): void {
    prismaInstance = instance;
}

function getPrisma(): any {
    return prismaInstance || defaultPrisma;
}

// ─── Types ────────────────────────────────────────────────────

/** Pièce justificative */
export interface PieceJustificative {
    type: string;
    label: string;
    status: 'PRESENT' | 'ABSENT' | 'INCOMPLET';
    detail: string;
    fichier?: {
        nom: string;
        chemin: string;
        dateGeneration: string;
    };
}

/** Émargement synthétisé */
export interface EmargementSynthese {
    date: string;
    demiJournee: string;
    present: boolean;
    absenceJustifiee: boolean;
    isFOAD: boolean;
    signatureStagiaire: boolean;
    signatureFormateur: boolean;
}

/** Évaluation synthétisée */
export interface EvaluationSynthese {
    type: string;
    score: number | null;
    commentaires: string | null;
    dateSaisie: string;
}

/** Récapitulatif financier */
export interface RecapFinancier {
    montantHT: number;
    montantTVA: number;
    montantTTC: number;
    typeContrat: string;
    dateSignature: string | null;
    accordFinancement: {
        recu: boolean;
        date: string | null;
        reference: string | null;
    };
    factureGeneree: boolean;
    dateFacture: string | null;
}

/** Dossier OPCO pour un stagiaire */
export interface OPCODossierStagiaire {
    dossierId: string;
    stagiaireNom: string;
    stagiairePrenom: string;
    stagiaireEmail: string;
    status: string;
    dateInscription: string;
    dateDebutEffectif: string | null;
    dateFinEffective: string | null;
    tauxAssiduite: number;
    certificatGenere: boolean;
    /** Présence d'un PSH */
    declarationPSH: boolean | null;
    adaptationsPSH: string | null;
    /** Émargements */
    emargements: EmargementSynthese[];
    /** Évaluations */
    evaluations: EvaluationSynthese[];
    /** Récapitulatif financier */
    recapFinancier: RecapFinancier | null;
    /** Pièces justificatives */
    pieces: PieceJustificative[];
    /** Complétude du dossier */
    completude: {
        score: number;
        manquants: string[];
    };
}

/** Information sur le financeur OPCO */
export interface OPCOFinanceurInfo {
    id: string;
    type: string;
    raisonSociale: string | null;
    codeOPCO: string | null;
    siret: string | null;
    contactNom: string | null;
    contactEmail: string | null;
}

/** Information sur le programme */
export interface OPCOProgrammeInfo {
    id: string;
    reference: string;
    intitule: string;
    objectifs: string;
    prerequis: string;
    dureeHeures: number;
    modalite: string;
    certificationCode: string | null;
    certificationIntitule: string | null;
}

/** Export OPCO complet */
export interface OPCOExport {
    metadata: {
        organizationId: string;
        organizationName: string;
        siret: string;
        ndaNumber: string | null;
        generatedAt: string;
        generatedBy: string;
        version: string;
    };
    financeur: OPCOFinanceurInfo;
    programme: OPCOProgrammeInfo;
    sessionInfo: {
        id: string;
        reference: string;
        dateDebut: string;
        dateFin: string;
        lieuFormation: string | null;
        siteName: string;
        siteCity: string;
    };
    stagiaires: OPCODossierStagiaire[];
    syntheseGlobale: {
        totalStagiaires: number;
        tauxAssiduiteGlobal: number;
        tauxCompletude: number;
        dossiersComplets: number;
        dossiersIncomplets: number;
        montantTotalHT: number;
        montantTotalTTC: number;
        alertes: string[];
    };
}

/** Liste paginée des contrats OPCO */
export interface OPCOContratListe {
    contrats: {
        contratId: string;
        sessionId: string;
        sessionRef: string;
        programmeIntitule: string;
        financeurNom: string;
        codeOPCO: string | null;
        nbStagiaires: number;
        montantHT: number;
        status: string;
        dateSignature: string | null;
    }[];
    total: number;
}

// ─── Service principal ───────────────────────────────────────

/**
 * Liste tous les contrats financés OPCO pour une organisation.
 * Permet de choisir quel contrat exporter.
 */
export async function listOPCOContrats(
    organizationId: string,
    exercice?: number,
): Promise<OPCOContratListe> {
    const db = getPrisma();
    const year = exercice || new Date().getFullYear();
    const periodeDebut = new Date(year, 0, 1);
    const periodeFin = new Date(year, 11, 31, 23, 59, 59);

    const contrats = await db.contrat.findMany({
        where: {
            dossier: { organizationId },
            financeur: { type: 'OPCO' },
            OR: [
                { dateDebutPrevue: { gte: periodeDebut, lte: periodeFin } },
                { dateFinPrevue: { gte: periodeDebut, lte: periodeFin } },
            ],
        },
        include: {
            financeur: true,
            dossier: {
                include: {
                    session: { include: { programme: true } },
                },
            },
        },
    });

    // Regrouper par session
    const sessionMap = new Map<string, {
        sessionId: string;
        sessionRef: string;
        programmeIntitule: string;
        financeurNom: string;
        codeOPCO: string | null;
        nbStagiaires: number;
        montantHT: number;
        status: string;
        dateSignature: string | null;
        contratId: string;
    }>();

    for (const c of contrats) {
        const sessionId = c.dossier.sessionId;
        const existing = sessionMap.get(sessionId);

        if (existing) {
            existing.nbStagiaires++;
            existing.montantHT += toNumber(c.montantHT);
        } else {
            sessionMap.set(sessionId, {
                contratId: c.id,
                sessionId,
                sessionRef: c.dossier.session.reference,
                programmeIntitule: c.dossier.session.programme?.intitule || 'N/A',
                financeurNom: c.financeur.raisonSociale || c.financeur.codeOPCO || 'OPCO',
                codeOPCO: c.financeur.codeOPCO,
                nbStagiaires: 1,
                montantHT: toNumber(c.montantHT),
                status: c.status,
                dateSignature: c.dateSignature?.toISOString() || null,
            });
        }
    }

    const result = Array.from(sessionMap.values())
        .map(c => ({ ...c, montantHT: Math.round(c.montantHT * 100) / 100 }))
        .sort((a, b) => b.montantHT - a.montantHT);

    return { contrats: result, total: result.length };
}

/**
 * Génère l'export complet d'un dossier OPCO pour une session donnée.
 * Regroupe tous les stagiaires financés par OPCO dans cette session.
 */
export async function generateOPCOExport(
    organizationId: string,
    sessionId: string,
    generatedBy: string = 'Système',
): Promise<OPCOExport> {
    const db = getPrisma();

    // ── 1. Organisation ───────────────────────────────────────
    const org = await db.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, siret: true, ndaNumber: true },
    });
    if (!org) throw new Error(`Organisation introuvable: ${organizationId}`);

    // ── 2. Session + Programme ────────────────────────────────
    const session = await db.session.findUnique({
        where: { id: sessionId },
        include: {
            programme: { include: { certification: true } },
            site: true,
        },
    });
    if (!session) throw new Error(`Session introuvable: ${sessionId}`);
    if (session.organizationId !== organizationId) {
        throw new Error('Session n\'appartient pas à cette organisation');
    }

    // ── 3. Dossiers financés OPCO ─────────────────────────────
    const dossiers = await db.dossier.findMany({
        where: {
            sessionId,
            organizationId,
            contrats: {
                some: { financeur: { type: 'OPCO' } },
            },
        },
        include: {
            contrats: { include: { financeur: true } },
            emargements: { orderBy: { dateEmargement: 'asc' } },
            evaluations: { orderBy: { dateSaisie: 'asc' } },
            preuves: true,
        },
    });

    if (dossiers.length === 0) {
        throw new Error('Aucun dossier financé OPCO pour cette session');
    }

    // ── 4. Financeur OPCO (premier trouvé) ────────────────────
    const opcoContrat = dossiers[0].contrats.find(
        (c: any) => c.financeur.type === 'OPCO',
    );
    const financeurData = opcoContrat?.financeur;

    const financeur: OPCOFinanceurInfo = {
        id: financeurData?.id || '',
        type: 'OPCO',
        raisonSociale: financeurData?.raisonSociale || null,
        codeOPCO: financeurData?.codeOPCO || null,
        siret: financeurData?.siret || null,
        contactNom: financeurData?.contactNom || null,
        contactEmail: financeurData?.contactEmail || null,
    };

    // ── 5. Programme ──────────────────────────────────────────
    const prog = session.programme;
    const programme: OPCOProgrammeInfo = {
        id: prog.id,
        reference: prog.reference,
        intitule: prog.intitule,
        objectifs: prog.objectifs,
        prerequis: prog.prerequis,
        dureeHeures: prog.dureeHeures,
        modalite: prog.modalite,
        certificationCode: prog.certification?.code || null,
        certificationIntitule: prog.certification?.intitule || null,
    };

    // ── 6. Construction des dossiers stagiaires ───────────────
    const alertes: string[] = [];

    const stagiaires: OPCODossierStagiaire[] = dossiers.map((d: any) => {
        const opcoContratDossier = d.contrats.find(
            (c: any) => c.financeur.type === 'OPCO',
        );

        // Émargements
        const emargements: EmargementSynthese[] = (d.emargements || []).map((e: any) => ({
            date: e.dateEmargement.toISOString(),
            demiJournee: e.demiJournee,
            present: e.estPresent,
            absenceJustifiee: e.absenceJustifiee,
            isFOAD: e.isFOAD,
            signatureStagiaire: !!e.signatureStagiaire,
            signatureFormateur: !!e.signatureFormateur,
        }));

        // Évaluations
        const evaluations: EvaluationSynthese[] = (d.evaluations || []).map((ev: any) => ({
            type: ev.type,
            score: ev.score,
            commentaires: ev.commentaires,
            dateSaisie: ev.dateSaisie.toISOString(),
        }));

        // Récapitulatif financier
        let recapFinancier: RecapFinancier | null = null;
        if (opcoContratDossier) {
            recapFinancier = {
                montantHT: toNumber(opcoContratDossier.montantHT),
                montantTVA: toNumber(opcoContratDossier.montantTVA),
                montantTTC: toNumber(opcoContratDossier.montantTTC),
                typeContrat: opcoContratDossier.type,
                dateSignature: opcoContratDossier.dateSignature?.toISOString() || null,
                accordFinancement: {
                    recu: opcoContratDossier.accordFinancementRecu,
                    date: opcoContratDossier.dateAccordFinancement?.toISOString() || null,
                    reference: opcoContratDossier.referenceAccord,
                },
                factureGeneree: d.factureGeneree,
                dateFacture: d.dateFacture?.toISOString() || null,
            };
        }

        // Pièces justificatives
        const pieces = buildPiecesJustificatives(d, opcoContratDossier);

        // Complétude
        const completude = computeCompletude(d, opcoContratDossier, emargements, pieces);

        return {
            dossierId: d.id,
            stagiaireNom: d.stagiaireNom,
            stagiairePrenom: d.stagiairePrenom,
            stagiaireEmail: d.stagiaireEmail,
            status: d.status,
            dateInscription: d.dateInscription.toISOString(),
            dateDebutEffectif: d.dateDebutEffectif?.toISOString() || null,
            dateFinEffective: d.dateFinEffective?.toISOString() || null,
            tauxAssiduite: toNumber(d.tauxAssiduite),
            certificatGenere: d.certificatGenere,
            declarationPSH: d.declarationPSH,
            adaptationsPSH: d.adaptationsPSH,
            emargements,
            evaluations,
            recapFinancier,
            pieces,
            completude,
        };
    });

    // ── 7. Synthèse globale ───────────────────────────────────
    const totalStagiaires = stagiaires.length;
    const assiduiteTotale = stagiaires.reduce((s, d) => s + d.tauxAssiduite, 0);
    const tauxAssiduiteGlobal = totalStagiaires > 0
        ? Math.round((assiduiteTotale / totalStagiaires) * 100) / 100
        : 0;

    const dossiersComplets = stagiaires.filter(s => s.completude.score === 100).length;
    const dossiersIncomplets = totalStagiaires - dossiersComplets;

    const montantTotalHT = stagiaires.reduce(
        (s, d) => s + (d.recapFinancier?.montantHT || 0), 0,
    );
    const montantTotalTTC = stagiaires.reduce(
        (s, d) => s + (d.recapFinancier?.montantTTC || 0), 0,
    );

    const tauxCompletude = totalStagiaires > 0
        ? Math.round((dossiersComplets / totalStagiaires) * 100)
        : 0;

    // Alertes globales
    if (dossiersIncomplets > 0) {
        alertes.push(
            `⚠️ ${dossiersIncomplets} dossier(s) incomplet(s). L'OPCO peut refuser le remboursement.`,
        );
    }

    const sansAccord = stagiaires.filter(s => !s.recapFinancier?.accordFinancement.recu);
    if (sansAccord.length > 0) {
        alertes.push(
            `🔴 ${sansAccord.length} dossier(s) sans accord de financement OPCO reçu.`,
        );
    }

    const sansCertificat = stagiaires.filter(
        s => ['TERMINE', 'CLOTURE', 'FACTURE'].includes(s.status) && !s.certificatGenere,
    );
    if (sansCertificat.length > 0) {
        alertes.push(
            `🔴 ${sansCertificat.length} dossier(s) terminé(s) sans certificat de réalisation.`,
        );
    }

    return {
        metadata: {
            organizationId,
            organizationName: org.name,
            siret: org.siret,
            ndaNumber: org.ndaNumber,
            generatedAt: new Date().toISOString(),
            generatedBy,
            version: '1.0.0',
        },
        financeur,
        programme,
        sessionInfo: {
            id: session.id,
            reference: session.reference,
            dateDebut: session.dateDebut.toISOString(),
            dateFin: session.dateFin.toISOString(),
            lieuFormation: session.lieuFormation,
            siteName: session.site.name,
            siteCity: session.site.city,
        },
        stagiaires,
        syntheseGlobale: {
            totalStagiaires,
            tauxAssiduiteGlobal,
            tauxCompletude,
            dossiersComplets,
            dossiersIncomplets,
            montantTotalHT: Math.round(montantTotalHT * 100) / 100,
            montantTotalTTC: Math.round(montantTotalTTC * 100) / 100,
            alertes,
        },
    };
}

// ─── Pièces justificatives ───────────────────────────────────

function buildPiecesJustificatives(dossier: any, contrat: any): PieceJustificative[] {
    const pieces: PieceJustificative[] = [];
    const preuves = dossier.preuves || [];

    // 1. Convention / Contrat de formation
    const contratPreuve = preuves.find((p: any) => p.type === 'CONTRAT_SIGNE');
    pieces.push({
        type: 'CONVENTION',
        label: contrat?.type === 'CONVENTION' ? 'Convention de formation' : 'Contrat de formation',
        status: contrat?.isSigned
            ? 'PRESENT'
            : contrat ? 'INCOMPLET' : 'ABSENT',
        detail: contrat?.isSigned
            ? `Signé le ${contrat.dateSignature?.toISOString().split('T')[0] || 'date inconnue'}`
            : contrat ? 'Non signé' : 'Aucun contrat',
        fichier: contratPreuve ? {
            nom: contratPreuve.nomFichier,
            chemin: contratPreuve.cheminFichier,
            dateGeneration: contratPreuve.dateGeneration.toISOString(),
        } : undefined,
    });

    // 2. Programme de formation
    const programmePreuve = preuves.find((p: any) => p.type === 'PROGRAMME');
    pieces.push({
        type: 'PROGRAMME',
        label: 'Programme de formation',
        status: programmePreuve ? 'PRESENT' : 'ABSENT',
        detail: programmePreuve
            ? `Généré le ${programmePreuve.dateGeneration.toISOString().split('T')[0]}`
            : 'Programme non attaché au dossier',
        fichier: programmePreuve ? {
            nom: programmePreuve.nomFichier,
            chemin: programmePreuve.cheminFichier,
            dateGeneration: programmePreuve.dateGeneration.toISOString(),
        } : undefined,
    });

    // 3. Feuilles d'émargement
    const emargementPreuves = preuves.filter((p: any) => p.type === 'EMARGEMENT');
    const hasEmargements = (dossier.emargements?.length || 0) > 0;
    pieces.push({
        type: 'EMARGEMENT',
        label: 'Feuilles d\'émargement',
        status: emargementPreuves.length > 0 ? 'PRESENT' :
            hasEmargements ? 'INCOMPLET' : 'ABSENT',
        detail: hasEmargements
            ? `${dossier.emargements.length} demi-journées enregistrées — ${emargementPreuves.length} feuille(s) PDF`
            : 'Aucun émargement enregistré',
    });

    // 4. Accord de financement OPCO
    const accordPreuve = preuves.find((p: any) => p.type === 'ACCORD_FINANCEMENT');
    pieces.push({
        type: 'ACCORD_FINANCEMENT',
        label: 'Accord de prise en charge OPCO',
        status: contrat?.accordFinancementRecu
            ? 'PRESENT'
            : 'ABSENT',
        detail: contrat?.accordFinancementRecu
            ? `Reçu le ${contrat.dateAccordFinancement?.toISOString().split('T')[0] || 'date inconnue'} — Réf: ${contrat.referenceAccord || 'N/A'}`
            : 'Accord non reçu',
        fichier: accordPreuve ? {
            nom: accordPreuve.nomFichier,
            chemin: accordPreuve.cheminFichier,
            dateGeneration: accordPreuve.dateGeneration.toISOString(),
        } : undefined,
    });

    // 5. Certificat de réalisation
    const certPreuve = preuves.find((p: any) => p.type === 'CERTIFICAT_REALISATION');
    pieces.push({
        type: 'CERTIFICAT_REALISATION',
        label: 'Certificat de réalisation',
        status: dossier.certificatGenere ? 'PRESENT' :
            ['TERMINE', 'CLOTURE', 'FACTURE'].includes(dossier.status) ? 'ABSENT' : 'NA' as any,
        detail: dossier.certificatGenere
            ? `Généré le ${dossier.dateCertificat?.toISOString().split('T')[0] || 'date inconnue'}`
            : ['TERMINE', 'CLOTURE', 'FACTURE'].includes(dossier.status)
                ? 'Formation terminée sans certificat — BLOQUANT'
                : 'Formation en cours — sera généré à l\'issue',
        fichier: certPreuve ? {
            nom: certPreuve.nomFichier,
            chemin: certPreuve.cheminFichier,
            dateGeneration: certPreuve.dateGeneration.toISOString(),
        } : undefined,
    });

    // 6. Évaluation à chaud
    const evalPreuve = preuves.find((p: any) => p.type === 'EVALUATION_CHAUD');
    const hasEvalChaud = dossier.evaluations?.some((e: any) => e.type === 'CHAUD');
    pieces.push({
        type: 'EVALUATION_CHAUD',
        label: 'Évaluation à chaud',
        status: evalPreuve || hasEvalChaud ? 'PRESENT' : 'ABSENT',
        detail: hasEvalChaud
            ? 'Évaluation saisie'
            : 'Évaluation non réalisée',
    });

    // 7. Facture
    const facturePreuve = preuves.find((p: any) => p.type === 'FACTURE');
    pieces.push({
        type: 'FACTURE',
        label: 'Facture',
        status: dossier.factureGeneree ? 'PRESENT' : 'ABSENT',
        detail: dossier.factureGeneree
            ? `Facturée le ${dossier.dateFacture?.toISOString().split('T')[0] || 'date inconnue'}`
            : 'Non facturé',
        fichier: facturePreuve ? {
            nom: facturePreuve.nomFichier,
            chemin: facturePreuve.cheminFichier,
            dateGeneration: facturePreuve.dateGeneration.toISOString(),
        } : undefined,
    });

    return pieces;
}

// ─── Complétude ───────────────────────────────────────────────

function computeCompletude(
    dossier: any,
    contrat: any,
    emargements: EmargementSynthese[],
    pieces: PieceJustificative[],
): { score: number; manquants: string[] } {
    const checks = [
        { label: 'Convention/Contrat signé', ok: !!contrat?.isSigned },
        { label: 'Accord de financement OPCO', ok: !!contrat?.accordFinancementRecu },
        { label: 'Émargements enregistrés', ok: emargements.length > 0 },
        { label: 'Évaluation à chaud', ok: pieces.find(p => p.type === 'EVALUATION_CHAUD')?.status === 'PRESENT' },
    ];

    // Le certificat n'est requis que pour les dossiers terminés
    const isTermine = ['TERMINE', 'CLOTURE', 'FACTURE'].includes(dossier.status);
    if (isTermine) {
        checks.push({
            label: 'Certificat de réalisation',
            ok: dossier.certificatGenere === true,
        });
        checks.push({
            label: 'Facture',
            ok: dossier.factureGeneree === true,
        });
    }

    const manquants = checks.filter(c => !c.ok).map(c => c.label);
    const score = checks.length > 0
        ? Math.round(((checks.length - manquants.length) / checks.length) * 100)
        : 100;

    return { score, manquants };
}

// ─── Export texte ─────────────────────────────────────────────

/**
 * Génère l'export texte du dossier OPCO.
 * Format structuré pour transmission ou archivage.
 */
export function generateOPCOTextExport(data: OPCOExport): string {
    const sep = '═'.repeat(80);
    const thin = '─'.repeat(80);
    const lines: string[] = [];

    lines.push(sep);
    lines.push('  DOSSIER DE FINANCEMENT — OPCO');
    lines.push(sep);
    lines.push('');

    // ── Identification ────────────────────────────────────────

    lines.push(thin);
    lines.push('  ORGANISME DE FORMATION');
    lines.push(thin);
    lines.push(`  ${data.metadata.organizationName}`);
    lines.push(`  SIRET: ${data.metadata.siret} | NDA: ${data.metadata.ndaNumber || 'N/A'}`);
    lines.push('');

    // ── Financeur OPCO ────────────────────────────────────────

    lines.push(thin);
    lines.push('  FINANCEUR OPCO');
    lines.push(thin);
    lines.push(`  ${data.financeur.raisonSociale || 'OPCO'} (Code: ${data.financeur.codeOPCO || 'N/A'})`);
    if (data.financeur.siret) lines.push(`  SIRET: ${data.financeur.siret}`);
    if (data.financeur.contactNom) lines.push(`  Contact: ${data.financeur.contactNom} (${data.financeur.contactEmail || ''})`);
    lines.push('');

    // ── Formation ─────────────────────────────────────────────

    lines.push(thin);
    lines.push('  ACTION DE FORMATION');
    lines.push(thin);
    const prog = data.programme;
    lines.push(`  ${prog.reference} — ${prog.intitule}`);
    lines.push(`  Modalité: ${prog.modalite} | Durée: ${prog.dureeHeures}h`);
    if (prog.certificationCode) {
        lines.push(`  Certification: ${prog.certificationCode} — ${prog.certificationIntitule}`);
    }
    lines.push(`  Objectifs: ${prog.objectifs.substring(0, 200)}${prog.objectifs.length > 200 ? '...' : ''}`);
    lines.push('');
    const si = data.sessionInfo;
    lines.push(`  Session: ${si.reference}`);
    lines.push(`  Du ${formatDate(si.dateDebut)} au ${formatDate(si.dateFin)}`);
    lines.push(`  Lieu: ${si.siteName} — ${si.siteCity}${si.lieuFormation ? ` (${si.lieuFormation})` : ''}`);
    lines.push('');

    // ── Synthèse ──────────────────────────────────────────────

    lines.push(thin);
    lines.push('  SYNTHÈSE');
    lines.push(thin);
    const sg = data.syntheseGlobale;
    lines.push(`  Nombre de stagiaires            : ${sg.totalStagiaires}`);
    lines.push(`  Dossiers complets               : ${sg.dossiersComplets}/${sg.totalStagiaires} (${sg.tauxCompletude}%)`);
    lines.push(`  Taux d'assiduité global         : ${sg.tauxAssiduiteGlobal}%`);
    lines.push(`  Montant total HT                : ${formatMontant(sg.montantTotalHT)}`);
    lines.push(`  Montant total TTC               : ${formatMontant(sg.montantTotalTTC)}`);
    lines.push('');

    if (sg.alertes.length > 0) {
        lines.push('  ⚠️ ALERTES:');
        for (const a of sg.alertes) lines.push(`    ${a}`);
        lines.push('');
    }

    // ── Dossiers stagiaires ───────────────────────────────────

    lines.push(thin);
    lines.push('  DOSSIERS STAGIAIRES');
    lines.push(thin);

    for (const stag of data.stagiaires) {
        lines.push('');
        lines.push(`  ┌─ ${stag.stagiairePrenom} ${stag.stagiaireNom} (${stag.stagiaireEmail})`);
        lines.push(`  │  Statut: ${stag.status} | Assiduité: ${stag.tauxAssiduite}%`);
        lines.push(`  │  Inscrit le: ${formatDate(stag.dateInscription)}`);
        if (stag.dateDebutEffectif) {
            lines.push(`  │  Début effectif: ${formatDate(stag.dateDebutEffectif)}`);
        }
        if (stag.dateFinEffective) {
            lines.push(`  │  Fin effective: ${formatDate(stag.dateFinEffective)}`);
        }
        if (stag.declarationPSH !== null) {
            lines.push(`  │  PSH: ${stag.declarationPSH ? 'Oui' : 'Non'}${stag.adaptationsPSH ? ` — ${stag.adaptationsPSH}` : ''}`);
        }

        // Complétude
        const completIcon = stag.completude.score === 100 ? '✅' : stag.completude.score >= 75 ? '⚠️' : '❌';
        lines.push(`  │  Complétude: ${completIcon} ${stag.completude.score}%`);
        if (stag.completude.manquants.length > 0) {
            lines.push(`  │  Manquants: ${stag.completude.manquants.join(', ')}`);
        }

        // Financier
        if (stag.recapFinancier) {
            const rf = stag.recapFinancier;
            lines.push(`  │  Montant HT: ${formatMontant(rf.montantHT)} | TTC: ${formatMontant(rf.montantTTC)}`);
            lines.push(`  │  Accord OPCO: ${rf.accordFinancement.recu ? '✅' : '❌'}${rf.accordFinancement.reference ? ` (Réf: ${rf.accordFinancement.reference})` : ''}`);
        }

        // Pièces
        lines.push(`  │  Pièces justificatives:`);
        for (const p of stag.pieces) {
            const icon = p.status === 'PRESENT' ? '✅' : p.status === 'INCOMPLET' ? '⚠️' : '❌';
            lines.push(`  │    ${icon} ${p.label} — ${p.detail}`);
        }
        lines.push('  └' + '─'.repeat(70));
    }

    lines.push('');
    lines.push(sep);
    lines.push(`  Document généré le ${formatDate(data.metadata.generatedAt)} par ${data.metadata.generatedBy}`);
    lines.push(`  Ce dossier doit être transmis à l'OPCO avec les justificatifs originaux.`);
    lines.push(sep);

    return lines.join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────

function toNumber(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (val instanceof Decimal) return val.toNumber();
    return parseFloat(String(val)) || 0;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR');
}

function formatMontant(val: number): string {
    return val.toLocaleString('fr-FR', {
        style: 'currency', currency: 'EUR',
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
}
