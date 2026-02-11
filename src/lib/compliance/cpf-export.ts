/**
 * SERVICE CDC / CPF — Caisse des Dépôts & Consignations
 * ================================================================
 * Gestion de la conformité aux exigences CPF (Compte Personnel
 * de Formation) et de la Caisse des Dépôts.
 * 
 * Ce service couvre :
 *   1. Vérification d'éligibilité CPF d'un programme
 *   2. Contrôle du droit de rétractation (14 jours)
 *   3. Déclaration de session (format EDOF)
 *   4. Récapitulatif global CPF pour un exercice
 *   5. Alertes et anomalies CPF
 * 
 * @Compliance: Code du travail L.6323-1 et suivants
 * @Compliance: Décret n° 2018-1153 relatif au CPF
 * @Compliance: Qualiopi — Indicateurs 2, 5, 12
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

/** Éligibilité CPF d'un programme */
export interface CPFEligibilite {
    programmeId: string;
    reference: string;
    intitule: string;
    isEligible: boolean;
    raisons: string[];
    certificationCode: string | null;
    certificationStatut: string | null;
    modalite: string;
    dureeHeures: number;
    tarifHT: number;
    tarifTTC: number;
}

/** Contrôle rétractation d'un contrat CPF */
export interface RetractationCheck {
    contratId: string;
    dossierId: string;
    stagiaireNom: string;
    dateSignature: string | null;
    dateFinRetractation: string | null;
    delaiJours: number;
    joursRestants: number;
    isRetractable: boolean;
    retractationRespectee: boolean;
    dateDebutFormation: string;
    alertes: string[];
}

/** Déclaration de session format EDOF */
export interface EDOFSessionDeclaration {
    /** Identifiant interne */
    sessionId: string;
    /** Référence de la session */
    referenceSession: string;
    /** Code RNCP ou RS de la certification */
    codeCertification: string | null;
    /** Intitulé de la formation */
    intituleFormation: string;
    /** Dates */
    dateDebut: string;
    dateFin: string;
    /** Durée en heures */
    dureeHeures: number;
    /** Modalité pédagogique */
    modalite: string;
    /** Lieu de réalisation */
    lieuFormation: string;
    codePostal: string;
    ville: string;
    /** Nombre de places */
    nbPlaces: number;
    nbPlacesOccupees: number;
    /** Tarif */
    tarifHT: number;
    tarifTTC: number;
    /** NDA de l'organisme */
    ndaOrganisme: string | null;
    /** SIRET de l'organisme */
    siretOrganisme: string;
    /** Statut de la déclaration */
    statut: 'DECLARABLE' | 'INCOMPLETE' | 'NON_ELIGIBLE';
    /** Anomalies bloquant la déclaration */
    anomalies: string[];
}

/** Stagiaire CPF synthétisé */
export interface StagiaireCPF {
    dossierId: string;
    nom: string;
    prenom: string;
    email: string;
    numeroCPF: string | null;
    soldeCPF: number;
    montantFormation: number;
    resteACharge: number;
    status: string;
    retractation: RetractationCheck;
    assiduiteConforme: boolean;
    certificatGenere: boolean;
}

/** Récapitulatif CPF pour un exercice */
export interface CPFRecapitulatif {
    metadata: {
        exercice: number;
        organizationId: string;
        organizationName: string;
        siret: string;
        ndaNumber: string | null;
        generatedAt: string;
        generatedBy: string;
    };
    eligibilite: {
        totalProgrammes: number;
        programmesEligibles: number;
        programmesNonEligibles: number;
        details: CPFEligibilite[];
    };
    sessions: {
        total: number;
        declarables: number;
        incompletes: number;
        nonEligibles: number;
        declarations: EDOFSessionDeclaration[];
    };
    stagiaires: {
        total: number;
        enCours: number;
        termines: number;
        abandonnes: number;
        details: StagiaireCPF[];
    };
    financier: {
        montantTotalCPF: number;
        montantFacture: number;
        montantEnAttente: number;
        tauxUtilisation: number;
    };
    retractation: {
        totalContrats: number;
        retractationsExercees: number;
        retractationsConfirmes: number;
        tauxConformiteRetractation: number;
    };
    alertes: string[];
}

// ─── Constantes ───────────────────────────────────────────────

/** Délai de rétractation légal CPF (jours ouvrables) */
const DELAI_RETRACTATION_JOURS = 14;

/** Seuil d'assiduité requis pour le CPF (%) */
const SEUIL_ASSIDUITE_CPF = 70;

/** Statuts considérés comme "actifs" pour le CPF */
const STATUTS_ACTIFS_CPF = ['EN_COURS', 'TERMINE', 'CLOTURE', 'FACTURE', 'ABANDONNE'];

// ─── Service principal ───────────────────────────────────────

/**
 * Vérifie l'éligibilité CPF de tous les programmes d'une organisation.
 */
export async function checkCPFEligibilite(
    organizationId: string,
): Promise<CPFEligibilite[]> {
    const db = getPrisma();

    const programmes = await db.programme.findMany({
        where: { organizationId, isPublished: true },
        include: { certification: true },
    });

    return programmes.map((prog: any) => {
        const raisons: string[] = [];
        let isEligible = true;

        // 1. Certification requise
        if (!prog.certification) {
            isEligible = false;
            raisons.push('Aucune certification associée (RNCP ou RS requis).');
        } else if (prog.certification.statut !== 'ACTIVE') {
            isEligible = false;
            raisons.push(`Certification ${prog.certification.code} non active (statut: ${prog.certification.statut}).`);
        }

        // 2. Programme publié
        if (!prog.isPublished) {
            isEligible = false;
            raisons.push('Programme non publié.');
        }

        // 3. Objectifs et prérequis renseignés
        if (!prog.objectifs || prog.objectifs.trim().length < 10) {
            isEligible = false;
            raisons.push('Objectifs pédagogiques insuffisants.');
        }

        if (!prog.prerequis || prog.prerequis.trim().length < 5) {
            raisons.push('Prérequis non détaillés (recommandé pour EDOF).');
        }

        // 4. Durée minimale
        if (prog.dureeHeures < 7) {
            isEligible = false;
            raisons.push('Durée inférieure au minimum légal (7h).');
        }

        // 5. Modalités d'évaluation
        if (!prog.modalitesEval || prog.modalitesEval.trim().length < 10) {
            raisons.push('Modalités d\'évaluation insuffisantes.');
        }

        return {
            programmeId: prog.id,
            reference: prog.reference,
            intitule: prog.intitule,
            isEligible,
            raisons: raisons.length > 0 ? raisons : ['Programme éligible CPF.'],
            certificationCode: prog.certification?.code || null,
            certificationStatut: prog.certification?.statut || null,
            modalite: prog.modalite,
            dureeHeures: prog.dureeHeures,
            tarifHT: toNumber(prog.tarifHT),
            tarifTTC: toNumber(prog.tarifTTC),
        };
    });
}

/**
 * Vérifie le droit de rétractation pour un contrat CPF.
 */
export function checkRetractation(contrat: any, dossier: any): RetractationCheck {
    const delai = contrat.delaiRetractationJours ?? DELAI_RETRACTATION_JOURS;
    const alertes: string[] = [];

    const dateSignature = contrat.dateSignature
        ? new Date(contrat.dateSignature)
        : null;

    let dateFinRetractation: Date | null = null;
    let joursRestants = 0;
    let isRetractable = false;

    if (dateSignature) {
        dateFinRetractation = new Date(dateSignature);
        dateFinRetractation.setDate(dateFinRetractation.getDate() + delai);

        const now = new Date();
        joursRestants = Math.max(0, Math.ceil(
            (dateFinRetractation.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ));
        isRetractable = joursRestants > 0;
    } else {
        alertes.push('Contrat non signé — rétractation non déclenchée.');
    }

    // Vérifier que la formation ne commence pas avant la fin de rétractation
    const dateDebut = dossier.dateDebutEffectif || dossier.session?.dateDebut;
    if (dateDebut && dateFinRetractation) {
        const debut = new Date(dateDebut);
        if (debut < dateFinRetractation) {
            alertes.push(
                `⚠️ La formation débute AVANT la fin du délai de rétractation (${dateFinRetractation.toLocaleDateString('fr-FR')}). Non conforme CPF.`,
            );
        }
    }

    return {
        contratId: contrat.id,
        dossierId: dossier.id,
        stagiaireNom: `${dossier.stagiairePrenom} ${dossier.stagiaireNom}`,
        dateSignature: dateSignature?.toISOString() || null,
        dateFinRetractation: dateFinRetractation?.toISOString() || null,
        delaiJours: delai,
        joursRestants,
        isRetractable,
        retractationRespectee: contrat.retractationRespectee,
        dateDebutFormation: dateDebut?.toISOString() || 'Non défini',
        alertes,
    };
}

/**
 * Génère la déclaration EDOF pour une session.
 */
export async function generateEDOFDeclaration(
    organizationId: string,
    sessionId: string,
): Promise<EDOFSessionDeclaration> {
    const db = getPrisma();

    const org = await db.organization.findUnique({
        where: { id: organizationId },
        select: { siret: true, ndaNumber: true },
    });
    if (!org) throw new Error('Organisation introuvable');

    const session = await db.session.findUnique({
        where: { id: sessionId },
        include: {
            programme: { include: { certification: true } },
            site: true,
            dossiers: true,
        },
    });
    if (!session) throw new Error('Session introuvable');

    const anomalies: string[] = [];
    let statut: EDOFSessionDeclaration['statut'] = 'DECLARABLE';

    const prog = session.programme;

    // Vérifications
    if (!prog.certification || prog.certification.statut !== 'ACTIVE') {
        anomalies.push('Programme sans certification active — non éligible CPF.');
        statut = 'NON_ELIGIBLE';
    }

    if (!org.ndaNumber) {
        anomalies.push('NDA organisme manquant.');
        statut = statut === 'NON_ELIGIBLE' ? 'NON_ELIGIBLE' : 'INCOMPLETE';
    }

    if (!session.site) {
        anomalies.push('Site de formation non renseigné.');
        statut = statut === 'NON_ELIGIBLE' ? 'NON_ELIGIBLE' : 'INCOMPLETE';
    }

    if (prog.dureeHeures < 7) {
        anomalies.push('Durée inférieure à 7h — non éligible.');
        statut = 'NON_ELIGIBLE';
    }

    const cpfDossiers = session.dossiers.filter(
        (d: any) => STATUTS_ACTIFS_CPF.includes(d.status),
    );

    return {
        sessionId: session.id,
        referenceSession: session.reference,
        codeCertification: prog.certification?.code || null,
        intituleFormation: prog.intitule,
        dateDebut: session.dateDebut.toISOString(),
        dateFin: session.dateFin.toISOString(),
        dureeHeures: prog.dureeHeures,
        modalite: prog.modalite,
        lieuFormation: session.lieuFormation || session.site?.name || 'N/A',
        codePostal: session.site?.zipCode || '',
        ville: session.site?.city || '',
        nbPlaces: session.capaciteMax || 0,
        nbPlacesOccupees: cpfDossiers.length,
        tarifHT: toNumber(prog.tarifHT),
        tarifTTC: toNumber(prog.tarifTTC),
        ndaOrganisme: org.ndaNumber,
        siretOrganisme: org.siret,
        statut,
        anomalies: anomalies.length > 0 ? anomalies : ['Session déclarable sur EDOF.'],
    };
}

/**
 * Génère le récapitulatif CPF complet pour un exercice.
 */
export async function generateCPFRecapitulatif(
    organizationId: string,
    exercice?: number,
    generatedBy: string = 'Système',
): Promise<CPFRecapitulatif> {
    const db = getPrisma();
    const year = exercice || new Date().getFullYear();
    const periodeDebut = new Date(year, 0, 1);
    const periodeFin = new Date(year, 11, 31, 23, 59, 59);

    // ── Organisation ──────────────────────────────────────────
    const org = await db.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, siret: true, ndaNumber: true },
    });
    if (!org) throw new Error(`Organisation introuvable: ${organizationId}`);

    // ── 1. Éligibilité programmes ─────────────────────────────
    const eligDetails = await checkCPFEligibilite(organizationId);
    const eligibles = eligDetails.filter(e => e.isEligible);
    const nonEligibles = eligDetails.filter(e => !e.isEligible);

    // ── 2. Sessions CPF de l'exercice ─────────────────────────
    const sessions = await db.session.findMany({
        where: {
            organizationId,
            OR: [
                { dateDebut: { gte: periodeDebut, lte: periodeFin } },
                { dateFin: { gte: periodeDebut, lte: periodeFin } },
            ],
            programme: { certification: { isNot: null } },
        },
        include: {
            programme: { include: { certification: true } },
            site: true,
            dossiers: true,
        },
    });

    const declarations: EDOFSessionDeclaration[] = [];
    for (const session of sessions) {
        const anomalies: string[] = [];
        let statut: EDOFSessionDeclaration['statut'] = 'DECLARABLE';

        if (!session.programme.certification || session.programme.certification.statut !== 'ACTIVE') {
            anomalies.push('Certification non active.');
            statut = 'NON_ELIGIBLE';
        }
        if (!org.ndaNumber) {
            anomalies.push('NDA manquant.');
            if (statut !== 'NON_ELIGIBLE') statut = 'INCOMPLETE';
        }

        const cpfDossiers = session.dossiers.filter(
            (d: any) => STATUTS_ACTIFS_CPF.includes(d.status),
        );

        declarations.push({
            sessionId: session.id,
            referenceSession: session.reference,
            codeCertification: session.programme.certification?.code || null,
            intituleFormation: session.programme.intitule,
            dateDebut: session.dateDebut.toISOString(),
            dateFin: session.dateFin.toISOString(),
            dureeHeures: session.programme.dureeHeures,
            modalite: session.programme.modalite,
            lieuFormation: session.lieuFormation || session.site?.name || 'N/A',
            codePostal: session.site?.zipCode || '',
            ville: session.site?.city || '',
            nbPlaces: session.capaciteMax || 0,
            nbPlacesOccupees: cpfDossiers.length,
            tarifHT: toNumber(session.programme.tarifHT),
            tarifTTC: toNumber(session.programme.tarifTTC),
            ndaOrganisme: org.ndaNumber,
            siretOrganisme: org.siret,
            statut,
            anomalies: anomalies.length > 0 ? anomalies : ['OK'],
        });
    }

    const declarables = declarations.filter(d => d.statut === 'DECLARABLE');
    const incompletes = declarations.filter(d => d.statut === 'INCOMPLETE');
    const nonEligiblesSessions = declarations.filter(d => d.statut === 'NON_ELIGIBLE');

    // ── 3. Dossiers CPF ───────────────────────────────────────
    const dossiersCPF = await db.dossier.findMany({
        where: {
            organizationId,
            contrats: { some: { financeur: { type: 'CPF' } } },
            dateInscription: { gte: periodeDebut, lte: periodeFin },
        },
        include: {
            contrats: { include: { financeur: true } },
            session: { include: { programme: true } },
        },
    });

    const alertes: string[] = [];
    const stagiairesDetails: StagiaireCPF[] = dossiersCPF.map((d: any) => {
        const cpfContrat = d.contrats.find(
            (c: any) => c.financeur.type === 'CPF',
        );
        const financeur = cpfContrat?.financeur;

        const retractation = cpfContrat
            ? checkRetractation(cpfContrat, d)
            : {
                contratId: '', dossierId: d.id, stagiaireNom: `${d.stagiairePrenom} ${d.stagiaireNom}`,
                dateSignature: null, dateFinRetractation: null, delaiJours: DELAI_RETRACTATION_JOURS,
                joursRestants: 0, isRetractable: false, retractationRespectee: false,
                dateDebutFormation: 'N/A', alertes: ['Aucun contrat CPF trouvé.'],
            };

        const montantFormation = cpfContrat ? toNumber(cpfContrat.montantTTC) : 0;
        const soldeCPF = financeur?.soldeCPF ? toNumber(financeur.soldeCPF) : 0;
        const resteACharge = Math.max(0, montantFormation - soldeCPF);

        const tauxAssiduite = toNumber(d.tauxAssiduite);
        const assiduiteConforme = tauxAssiduite >= SEUIL_ASSIDUITE_CPF;

        if (!assiduiteConforme && STATUTS_ACTIFS_CPF.includes(d.status)) {
            retractation.alertes.push(`Assiduité insuffisante: ${tauxAssiduite}% (seuil: ${SEUIL_ASSIDUITE_CPF}%).`);
        }

        return {
            dossierId: d.id,
            nom: d.stagiaireNom,
            prenom: d.stagiairePrenom,
            email: d.stagiaireEmail,
            numeroCPF: financeur?.numeroCPF || null,
            soldeCPF,
            montantFormation,
            resteACharge,
            status: d.status,
            retractation,
            assiduiteConforme,
            certificatGenere: d.certificatGenere,
        };
    });

    const enCours = stagiairesDetails.filter(s => s.status === 'EN_COURS').length;
    const termines = stagiairesDetails.filter(s =>
        ['TERMINE', 'CLOTURE', 'FACTURE'].includes(s.status),
    ).length;
    const abandonnes = stagiairesDetails.filter(s => s.status === 'ABANDONNE').length;

    // ── 4. Financier ──────────────────────────────────────────
    const montantTotalCPF = stagiairesDetails.reduce((s, d) => s + d.montantFormation, 0);
    const montantFacture = stagiairesDetails
        .filter(s => s.status === 'FACTURE')
        .reduce((s, d) => s + d.montantFormation, 0);
    const montantEnAttente = montantTotalCPF - montantFacture;
    const tauxUtilisation = montantTotalCPF > 0
        ? Math.round((montantFacture / montantTotalCPF) * 100)
        : 0;

    // ── 5. Rétractation ───────────────────────────────────────
    const totalContrats = stagiairesDetails.length;
    const contratsMissingRetractation = stagiairesDetails
        .filter(s => s.retractation.dateSignature && !s.retractation.retractationRespectee);
    const retractationsExercees = stagiairesDetails
        .filter(s => s.status === 'ABANDONNE' && s.retractation.isRetractable).length;
    const retractationsConfirmes = stagiairesDetails
        .filter(s => s.retractation.retractationRespectee).length;
    const tauxConformiteRetractation = totalContrats > 0
        ? Math.round((retractationsConfirmes / totalContrats) * 100)
        : 100;

    // ── 6. Alertes globales ───────────────────────────────────
    if (eligibles.length === 0) {
        alertes.push('🔴 Aucun programme éligible CPF — vérifier les certifications.');
    }

    if (declarables.length === 0 && sessions.length > 0) {
        alertes.push('⚠️ Aucune session déclarable sur EDOF.');
    }

    const sansNumeroCPF = stagiairesDetails.filter(s => !s.numeroCPF);
    if (sansNumeroCPF.length > 0) {
        alertes.push(`⚠️ ${sansNumeroCPF.length} stagiaire(s) sans numéro CPF renseigné.`);
    }

    if (tauxConformiteRetractation < 100 && totalContrats > 0) {
        alertes.push(
            `⚠️ Conformité rétractation: ${tauxConformiteRetractation}% (${contratsMissingRetractation.length} contrat(s) sans respect du délai).`,
        );
    }

    const terminésSansCertif = stagiairesDetails.filter(
        s => ['TERMINE', 'CLOTURE'].includes(s.status) && !s.certificatGenere,
    );
    if (terminésSansCertif.length > 0) {
        alertes.push(
            `🔴 ${terminésSansCertif.length} stagiaire(s) terminé(s) sans certificat de réalisation.`,
        );
    }

    return {
        metadata: {
            exercice: year,
            organizationId,
            organizationName: org.name,
            siret: org.siret,
            ndaNumber: org.ndaNumber,
            generatedAt: new Date().toISOString(),
            generatedBy,
        },
        eligibilite: {
            totalProgrammes: eligDetails.length,
            programmesEligibles: eligibles.length,
            programmesNonEligibles: nonEligibles.length,
            details: eligDetails,
        },
        sessions: {
            total: declarations.length,
            declarables: declarables.length,
            incompletes: incompletes.length,
            nonEligibles: nonEligiblesSessions.length,
            declarations,
        },
        stagiaires: {
            total: stagiairesDetails.length,
            enCours,
            termines,
            abandonnes,
            details: stagiairesDetails,
        },
        financier: {
            montantTotalCPF: Math.round(montantTotalCPF * 100) / 100,
            montantFacture: Math.round(montantFacture * 100) / 100,
            montantEnAttente: Math.round(montantEnAttente * 100) / 100,
            tauxUtilisation,
        },
        retractation: {
            totalContrats,
            retractationsExercees,
            retractationsConfirmes,
            tauxConformiteRetractation,
        },
        alertes,
    };
}

// ─── Export texte ─────────────────────────────────────────────

/**
 * Génère l'export texte du récapitulatif CPF.
 */
export function generateCPFTextExport(data: CPFRecapitulatif): string {
    const sep = '═'.repeat(80);
    const thin = '─'.repeat(80);
    const lines: string[] = [];

    lines.push(sep);
    lines.push('  RÉCAPITULATIF CPF — CAISSE DES DÉPÔTS');
    lines.push(`  Exercice ${data.metadata.exercice}`);
    lines.push(`  Organisation: ${data.metadata.organizationName}`);
    lines.push(`  SIRET: ${data.metadata.siret} | NDA: ${data.metadata.ndaNumber || 'N/A'}`);
    lines.push(sep);
    lines.push('');

    // ── 1. Éligibilité programmes ─────────────────────────────

    lines.push(thin);
    lines.push('  1. ÉLIGIBILITÉ CPF DES PROGRAMMES');
    lines.push(thin);
    lines.push(`  Total programmes: ${data.eligibilite.totalProgrammes}`);
    lines.push(`  ✅ Éligibles CPF: ${data.eligibilite.programmesEligibles}`);
    lines.push(`  ❌ Non éligibles: ${data.eligibilite.programmesNonEligibles}`);
    lines.push('');
    for (const prog of data.eligibilite.details) {
        const icon = prog.isEligible ? '✅' : '❌';
        lines.push(`  ${icon} ${prog.reference} — ${prog.intitule}`);
        lines.push(`     Cert: ${prog.certificationCode || 'Aucune'} | ${prog.dureeHeures}h | ${prog.modalite}`);
        for (const r of prog.raisons) lines.push(`       → ${r}`);
    }
    lines.push('');

    // ── 2. Sessions EDOF ──────────────────────────────────────

    lines.push(thin);
    lines.push('  2. SESSIONS — DÉCLARATION EDOF');
    lines.push(thin);
    lines.push(`  Total sessions certifiantes: ${data.sessions.total}`);
    lines.push(`  ✅ Déclarables: ${data.sessions.declarables}`);
    lines.push(`  ⚠️ Incomplètes: ${data.sessions.incompletes}`);
    lines.push(`  ❌ Non éligibles: ${data.sessions.nonEligibles}`);
    lines.push('');
    for (const s of data.sessions.declarations) {
        const icon = s.statut === 'DECLARABLE' ? '✅' :
            s.statut === 'INCOMPLETE' ? '⚠️' : '❌';
        lines.push(`  ${icon} ${s.referenceSession} — ${s.intituleFormation}`);
        lines.push(`     Du ${formatDate(s.dateDebut)} au ${formatDate(s.dateFin)} | ${s.ville}`);
        lines.push(`     Places: ${s.nbPlacesOccupees}/${s.nbPlaces} | Tarif: ${s.tarifTTC}€ TTC`);
        if (s.anomalies.length > 0 && s.anomalies[0] !== 'OK') {
            for (const a of s.anomalies) lines.push(`       ⚠️ ${a}`);
        }
    }
    lines.push('');

    // ── 3. Stagiaires ─────────────────────────────────────────

    lines.push(thin);
    lines.push('  3. STAGIAIRES CPF');
    lines.push(thin);
    lines.push(`  Total: ${data.stagiaires.total}`);
    lines.push(`  En cours: ${data.stagiaires.enCours} | Terminés: ${data.stagiaires.termines} | Abandons: ${data.stagiaires.abandonnes}`);
    lines.push('');

    for (const s of data.stagiaires.details) {
        lines.push(`  • ${s.prenom} ${s.nom} (${s.email})`);
        lines.push(`    CPF n°: ${s.numeroCPF || 'N/A'} | Solde: ${s.soldeCPF}€ | Formation: ${s.montantFormation}€ TTC`);
        lines.push(`    RAC: ${s.resteACharge}€ | Assiduité: ${s.assiduiteConforme ? '✅' : '❌'} | Certificat: ${s.certificatGenere ? '✅' : '❌'}`);
        if (s.retractation.alertes.length > 0) {
            for (const a of s.retractation.alertes) lines.push(`    ⚠️ ${a}`);
        }
    }
    lines.push('');

    // ── 4. Financier ──────────────────────────────────────────

    lines.push(thin);
    lines.push('  4. BILAN FINANCIER CPF');
    lines.push(thin);
    lines.push(`  Montant total CPF               : ${formatMontant(data.financier.montantTotalCPF)}`);
    lines.push(`  Montant facturé                  : ${formatMontant(data.financier.montantFacture)}`);
    lines.push(`  En attente de facturation        : ${formatMontant(data.financier.montantEnAttente)}`);
    lines.push(`  Taux d'utilisation               : ${data.financier.tauxUtilisation}%`);
    lines.push('');

    // ── 5. Rétractation ───────────────────────────────────────

    lines.push(thin);
    lines.push('  5. CONFORMITÉ RÉTRACTATION (14 jours)');
    lines.push(thin);
    lines.push(`  Total contrats CPF               : ${data.retractation.totalContrats}`);
    lines.push(`  Rétractations exercées           : ${data.retractation.retractationsExercees}`);
    lines.push(`  Délai confirmé conforme          : ${data.retractation.retractationsConfirmes}`);
    lines.push(`  Taux conformité rétractation     : ${data.retractation.tauxConformiteRetractation}%`);
    lines.push('');

    // ── 6. Alertes ────────────────────────────────────────────

    if (data.alertes.length > 0) {
        lines.push(thin);
        lines.push('  6. ALERTES ET ANOMALIES');
        lines.push(thin);
        for (const a of data.alertes) lines.push(`  ${a}`);
        lines.push('');
    }

    lines.push(sep);
    lines.push(`  Rapport généré le ${formatDate(data.metadata.generatedAt)} par ${data.metadata.generatedBy}`);
    lines.push(`  Ce document est destiné au suivi interne CPF et à la déclaration EDOF.`);
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
