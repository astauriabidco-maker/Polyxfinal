/**
 * SERVICE BPF — Bilan Pédagogique et Financier (Cerfa 10443*04)
 * ================================================================
 * Obligation annuelle de tout organisme de formation :
 *   - Art. L.6352-11 du Code du travail
 *   - Art. R.6352-22 à R.6352-24
 *   - Déclaration à la DRIEETS (ex-DIRECCTE)
 * 
 * Ce service agrège les données des modèles Prisma :
 *   Dossier → Contrat → Financeur, Session → Programme → Certification
 *   Emargement, Partner (sous-traitance)
 * 
 * Périodes : exercice comptable (1er janvier → 31 décembre par défaut)
 * 
 * @Compliance: Code du travail Art. L.6352-11, R.6352-22
 * @Compliance: Qualiopi référentiel (contribution BPF)
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

/** Identification de l'organisme (Cadre A du Cerfa) */
export interface BPFIdentification {
    raisonSociale: string;
    siret: string;
    ndaNumber: string | null;
    type: string;
    qualiopiCertified: boolean;
    qualiopiExpiry: string | null;
    responsableName: string | null;
    adresse: string | null;
}

/** Statistiques financières (Cadre B du Cerfa — simplifié) */
export interface BPFBilanFinancier {
    /** Produits de l'activité de formation */
    produitsFormation: {
        /** CA total des conventions/contrats */
        caTotal: number;
        /** Dont financements OPCO */
        caOPCO: number;
        /** Dont financements CPF (Caisse des Dépôts) */
        caCPF: number;
        /** Dont financements Entreprise directe */
        caEntreprise: number;
        /** Dont financements Individuels */
        caIndividuel: number;
        /** Dont financements Mixtes */
        caMixte: number;
    };
    /** Nombre total de conventions/contrats signés */
    nbConventions: number;
    nbContrats: number;
    /** Montant total facturé */
    montantFacture: number;
    /** Taux de facturation (facturé / CA total) */
    tauxFacturation: number;
}

/** Catégorie de publics (Cadre C1 du Cerfa) */
export interface BPFPublicCategorie {
    label: string;
    code: string;
    total: number;
    hommes: number;
    femmes: number;
    nonRenseigne: number;
}

/** Statistiques pédagogiques (Cadre C du Cerfa) */
export interface BPFBilanPedagogique {
    /** C1 — Nombre total de stagiaires */
    totalStagiaires: number;
    /** C1 — Répartition par source de financement */
    stagiairesParFinanceur: {
        opco: number;
        cpf: number;
        entreprise: number;
        personnel: number;
        mixte: number;
    };
    /** C1 — Répartition par statut à l'entrée (proxy : type de financeur) */
    stagiairesParPublic: BPFPublicCategorie[];
    /** C2 — Nombre total d'heures de formation dispensées */
    totalHeuresDispensees: number;
    /** C2 — Répartition des heures par modalité */
    heuresParModalite: {
        presentiel: number;
        foad: number;
        mixte: number;
    };
    /** C3 — Nombre de sessions de formation réalisées */
    totalSessions: number;
    /** C3 — Sessions terminées vs en cours */
    sessionsTerminees: number;
    sessionsEnCours: number;
    sessionsAbandonnees: number;
    /** C4 — Taux d'assiduité moyen sur l'exercice */
    tauxAssiduiteGlobal: number;
    /** C5 — Taux de réussite (dossiers terminés + clôturés / total actifs) */
    tauxReussite: number;
    /** C6 — Nombre de certificats de réalisation générés */
    nbCertificatsGeneres: number;
    /** C7 — Répartition par actions de formation */
    actionsFormation: BPFActionFormation[];
}

/** Détail d'une action de formation (Programme) */
export interface BPFActionFormation {
    programmeId: string;
    reference: string;
    intitule: string;
    dureeHeures: number;
    modalite: string;
    certificationCode: string | null;
    certificationIntitule: string | null;
    nbStagiaires: number;
    nbSessions: number;
    nbHeuresRealisees: number;
    caHT: number;
}

/** Sous-traitance (Cadre D du Cerfa) */
export interface BPFSousTraitance {
    /** Sous-traitance confiée (vous confiez à des partenaires) */
    confiee: {
        nbPartenaires: number;
        partenaires: {
            companyName: string;
            siret: string | null;
            status: string;
            conventionSigned: boolean;
            totalLeads: number;
        }[];
    };
    /** Sous-traitance reçue : nécessite des données supplémentaires non modélisées */
    recue: {
        mention: string;
    };
}

/** Rapport BPF complet */
export interface BPFReport {
    metadata: {
        exercice: number;
        periodeDebut: string;
        periodeFin: string;
        organizationId: string;
        generatedAt: string;
        generatedBy: string;
        version: string;
        reference: string;
    };
    identification: BPFIdentification;
    bilanFinancier: BPFBilanFinancier;
    bilanPedagogique: BPFBilanPedagogique;
    sousTraitance: BPFSousTraitance;
    alertes: string[];
}

// ─── Service principal ───────────────────────────────────────

/**
 * Génère le Bilan Pédagogique et Financier pour un exercice donné.
 * 
 * @param organizationId - ID de l'organisme
 * @param exercice - Année de l'exercice (défaut: année précédente)
 * @param generatedBy - Nom de l'utilisateur générant le rapport
 * @returns BPFReport complet
 */
export async function generateBPF(
    organizationId: string,
    exercice?: number,
    generatedBy: string = 'Système',
): Promise<BPFReport> {
    const db = getPrisma();
    const year = exercice || new Date().getFullYear() - 1;
    const periodeDebut = new Date(year, 0, 1);   // 1er janvier
    const periodeFin = new Date(year, 11, 31, 23, 59, 59); // 31 décembre

    const alertes: string[] = [];

    // ── A. Identification ─────────────────────────────────────
    const org = await db.organization.findUnique({
        where: { id: organizationId },
        select: {
            name: true,
            siret: true,
            ndaNumber: true,
            type: true,
            qualiopiCertified: true,
            qualiopiExpiry: true,
            responsableName: true,
        },
    });

    if (!org) {
        throw new Error(`Organisation introuvable: ${organizationId}`);
    }

    if (!org.ndaNumber) {
        alertes.push('⚠️ Numéro de Déclaration d\'Activité (NDA) non renseigné — obligatoire pour le BPF.');
    }

    if (!org.qualiopiCertified) {
        alertes.push('🔴 Certification Qualiopi non active — le BPF sera incomplet.');
    }

    const identification: BPFIdentification = {
        raisonSociale: org.name,
        siret: org.siret,
        ndaNumber: org.ndaNumber,
        type: org.type,
        qualiopiCertified: org.qualiopiCertified,
        qualiopiExpiry: org.qualiopiExpiry?.toISOString() || null,
        responsableName: org.responsableName,
        adresse: null, // à enrichir si le champ existe
    };

    // ── B. Requêtes de données ────────────────────────────────

    // Tous les dossiers de l'exercice (ceux dont la session chevauche la période)
    const dossiers = await db.dossier.findMany({
        where: {
            organizationId,
            session: {
                OR: [
                    // Session qui commence dans l'exercice
                    { dateDebut: { gte: periodeDebut, lte: periodeFin } },
                    // Session qui finit dans l'exercice
                    { dateFin: { gte: periodeDebut, lte: periodeFin } },
                    // Session qui englobe l'exercice
                    { dateDebut: { lte: periodeDebut }, dateFin: { gte: periodeFin } },
                ],
            },
        },
        include: {
            contrats: {
                include: {
                    financeur: true,
                },
            },
            session: {
                include: {
                    programme: {
                        include: {
                            certification: true,
                        },
                    },
                },
            },
            emargements: {
                where: {
                    dateEmargement: { gte: periodeDebut, lte: periodeFin },
                },
            },
        },
    });

    // Sessions de l'exercice
    const sessions = await db.session.findMany({
        where: {
            organizationId,
            OR: [
                { dateDebut: { gte: periodeDebut, lte: periodeFin } },
                { dateFin: { gte: periodeDebut, lte: periodeFin } },
                { dateDebut: { lte: periodeDebut }, dateFin: { gte: periodeFin } },
            ],
        },
        include: {
            programme: {
                include: {
                    certification: true,
                },
            },
            dossiers: {
                include: {
                    contrats: { include: { financeur: true } },
                },
            },
        },
    });

    // Partenaires (sous-traitance confiée)
    const partners = await db.partner.findMany({
        where: { organizationId },
        include: { qualification: true },
    });

    // ── C. Bilan Financier ────────────────────────────────────

    const bilanFinancier = computeBilanFinancier(dossiers, alertes);

    // ── D. Bilan Pédagogique ──────────────────────────────────

    const bilanPedagogique = computeBilanPedagogique(dossiers, sessions, alertes);

    // ── E. Sous-traitance ─────────────────────────────────────

    const sousTraitance = computeSousTraitance(partners, alertes);

    // ── F. Construction du rapport ────────────────────────────

    return {
        metadata: {
            exercice: year,
            periodeDebut: periodeDebut.toISOString(),
            periodeFin: periodeFin.toISOString(),
            organizationId,
            generatedAt: new Date().toISOString(),
            generatedBy,
            version: '1.0.0',
            reference: `BPF-${year}-${organizationId.substring(0, 8)}`,
        },
        identification,
        bilanFinancier,
        bilanPedagogique,
        sousTraitance,
        alertes,
    };
}

// ─── Calculs détaillés ────────────────────────────────────────

function toNumber(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (val instanceof Decimal) return val.toNumber();
    return parseFloat(String(val)) || 0;
}

function computeBilanFinancier(dossiers: any[], alertes: string[]): BPFBilanFinancier {
    let caTotal = 0;
    let caOPCO = 0;
    let caCPF = 0;
    let caEntreprise = 0;
    let caIndividuel = 0;
    let caMixte = 0;
    let nbConventions = 0;
    let nbContrats = 0;
    let montantFacture = 0;

    for (const d of dossiers) {
        for (const contrat of d.contrats || []) {
            const mt = toNumber(contrat.montantHT);
            caTotal += mt;

            const finType = contrat.financeur?.type;
            switch (finType) {
                case 'OPCO': caOPCO += mt; break;
                case 'CPF': caCPF += mt; break;
                case 'ENTREPRISE': caEntreprise += mt; break;
                case 'PERSONNEL': caIndividuel += mt; break;
                case 'MIXTE': caMixte += mt; break;
            }

            if (contrat.type === 'CONVENTION') nbConventions++;
            if (contrat.type === 'CONTRAT') nbContrats++;

            if (d.factureGeneree) {
                montantFacture += mt;
            }
        }
    }

    if (caTotal === 0) {
        alertes.push('⚠️ Aucun chiffre d\'affaires formation sur l\'exercice.');
    }

    const tauxFacturation = caTotal > 0 ? Math.round((montantFacture / caTotal) * 100) : 0;

    return {
        produitsFormation: {
            caTotal: Math.round(caTotal * 100) / 100,
            caOPCO: Math.round(caOPCO * 100) / 100,
            caCPF: Math.round(caCPF * 100) / 100,
            caEntreprise: Math.round(caEntreprise * 100) / 100,
            caIndividuel: Math.round(caIndividuel * 100) / 100,
            caMixte: Math.round(caMixte * 100) / 100,
        },
        nbConventions,
        nbContrats,
        montantFacture: Math.round(montantFacture * 100) / 100,
        tauxFacturation,
    };
}

function computeBilanPedagogique(
    dossiers: any[],
    sessions: any[],
    alertes: string[],
): BPFBilanPedagogique {
    // ── C1 — Stagiaires ───────────────────────────────────────

    // On ne compte que les dossiers qui ont démarré (≥ EN_COURS)
    const STATUS_ACTIFS = [
        'EN_COURS', 'SUSPENDU', 'TERMINE', 'CLOTURE', 'FACTURE', 'ABANDONNE',
    ];

    const dossiersActifs = dossiers.filter(d => STATUS_ACTIFS.includes(d.status));
    const totalStagiaires = dossiersActifs.length;

    // Par financeur (on prend le premier contrat de chaque dossier)
    const stagiairesParFinanceur = { opco: 0, cpf: 0, entreprise: 0, personnel: 0, mixte: 0 };
    for (const d of dossiersActifs) {
        const firstContrat = d.contrats?.[0];
        const finType = firstContrat?.financeur?.type;
        switch (finType) {
            case 'OPCO': stagiairesParFinanceur.opco++; break;
            case 'CPF': stagiairesParFinanceur.cpf++; break;
            case 'ENTREPRISE': stagiairesParFinanceur.entreprise++; break;
            case 'PERSONNEL': stagiairesParFinanceur.personnel++; break;
            case 'MIXTE': stagiairesParFinanceur.mixte++; break;
            default:
                // Sans contrat → on ne sait pas
                break;
        }
    }

    // Par catégorie de public (proxy basé sur le type de financeur)
    const stagiairesParPublic: BPFPublicCategorie[] = [
        {
            label: 'Salariés (plan de développement des compétences)',
            code: 'SALARIE_PDC',
            total: stagiairesParFinanceur.opco + stagiairesParFinanceur.entreprise,
            hommes: 0, femmes: 0,
            nonRenseigne: stagiairesParFinanceur.opco + stagiairesParFinanceur.entreprise,
        },
        {
            label: 'Particuliers (autofinancement)',
            code: 'PARTICULIER',
            total: stagiairesParFinanceur.personnel,
            hommes: 0, femmes: 0,
            nonRenseigne: stagiairesParFinanceur.personnel,
        },
        {
            label: 'Titulaires CPF (Mon Compte Formation)',
            code: 'CPF',
            total: stagiairesParFinanceur.cpf,
            hommes: 0, femmes: 0,
            nonRenseigne: stagiairesParFinanceur.cpf,
        },
        {
            label: 'Financement mixte',
            code: 'MIXTE',
            total: stagiairesParFinanceur.mixte,
            hommes: 0, femmes: 0,
            nonRenseigne: stagiairesParFinanceur.mixte,
        },
    ];

    // ── C2 — Heures de formation dispensées ───────────────────

    // Méthode 1 : par émargements (plus précis)
    let totalDemiJournees = 0;
    let demiJourneesPresentiel = 0;
    let demiJourneesFOAD = 0;

    for (const d of dossiersActifs) {
        for (const e of d.emargements || []) {
            if (e.estPresent || e.absenceJustifiee) {
                totalDemiJournees++;
                if (e.isFOAD) {
                    demiJourneesFOAD++;
                } else {
                    demiJourneesPresentiel++;
                }
            }
        }
    }

    // Conversion : 1 demi-journée = 3.5h (convention standard)
    const HEURES_PAR_DEMI_JOURNEE = 3.5;
    const heuresPresentiel = demiJourneesPresentiel * HEURES_PAR_DEMI_JOURNEE;
    const heuresFOAD = demiJourneesFOAD * HEURES_PAR_DEMI_JOURNEE;
    const totalHeuresRealisees = heuresPresentiel + heuresFOAD;

    // Méthode 2 : par programme (heures théoriques si pas d'émargements)
    let totalHeuresTheoriques = 0;
    for (const d of dossiersActifs) {
        totalHeuresTheoriques += d.session?.programme?.dureeHeures || 0;
    }

    // On prend les heures réalisées si disponibles, sinon les théoriques
    const totalHeuresDispensees = totalHeuresRealisees > 0 ? totalHeuresRealisees : totalHeuresTheoriques;

    if (totalHeuresRealisees === 0 && totalHeuresTheoriques > 0) {
        alertes.push(
            '⚠️ Aucun émargement enregistré — les heures sont calculées sur la base théorique des programmes. ' +
            'Pour le BPF, les heures réellement dispensées (émargements) sont préférables.',
        );
    }

    // Répartition par modalité
    const heuresMixte = sessions
        .filter(s => s.programme?.modalite === 'MIXTE')
        .reduce((sum: number, s: any) => {
            const nbDossiers = s.dossiers?.filter((d: any) => STATUS_ACTIFS.includes(d.status)).length || 0;
            return sum + (s.programme?.dureeHeures || 0) * nbDossiers;
        }, 0);

    const heuresParModalite = {
        presentiel: Math.round(heuresPresentiel * 10) / 10 || 0,
        foad: Math.round(heuresFOAD * 10) / 10 || 0,
        mixte: heuresMixte || 0,
    };

    // ── C3 — Sessions ─────────────────────────────────────────

    const totalSessions = sessions.length;
    const sessionsTerminees = sessions.filter(
        (s: any) => ['TERMINE', 'CLOTURE', 'FACTURE'].includes(s.status),
    ).length;
    const sessionsEnCours = sessions.filter(
        (s: any) => ['EN_COURS', 'ACTIF'].includes(s.status),
    ).length;
    const sessionsAbandonnees = sessions.filter(
        (s: any) => s.status === 'ABANDONNE',
    ).length;

    // ── C4 — Assiduité ────────────────────────────────────────

    const assiduiteTotale = dossiersActifs.reduce((sum, d) => sum + toNumber(d.tauxAssiduite), 0);
    const tauxAssiduiteGlobal = dossiersActifs.length > 0
        ? Math.round((assiduiteTotale / dossiersActifs.length) * 100) / 100
        : 0;

    if (tauxAssiduiteGlobal < 70) {
        alertes.push(
            `⚠️ Taux d'assiduité global faible (${tauxAssiduiteGlobal}%). ` +
            'Un taux < 70% peut attirer l\'attention lors d\'un contrôle DRIEETS.',
        );
    }

    // ── C5 — Taux de réussite ─────────────────────────────────

    const dossiersTermines = dossiersActifs.filter(
        d => ['TERMINE', 'CLOTURE', 'FACTURE'].includes(d.status),
    ).length;
    const tauxReussite = dossiersActifs.length > 0
        ? Math.round((dossiersTermines / dossiersActifs.length) * 100)
        : 0;

    // ── C6 — Certificats de réalisation ───────────────────────

    const nbCertificatsGeneres = dossiersActifs.filter(d => d.certificatGenere).length;

    if (dossiersTermines > 0 && nbCertificatsGeneres < dossiersTermines) {
        alertes.push(
            `⚠️ ${dossiersTermines - nbCertificatsGeneres} dossier(s) terminé(s) sans certificat de réalisation. ` +
            'La DRIEETS et les OPCO exigent un certificat pour chaque action terminée.',
        );
    }

    // ── C7 — Actions de formation (par programme) ─────────────

    const programmesMap = new Map<string, BPFActionFormation>();

    for (const session of sessions) {
        const prog = session.programme;
        if (!prog) continue;

        const existing = programmesMap.get(prog.id) || {
            programmeId: prog.id,
            reference: prog.reference,
            intitule: prog.intitule,
            dureeHeures: prog.dureeHeures,
            modalite: prog.modalite,
            certificationCode: prog.certification?.code || null,
            certificationIntitule: prog.certification?.intitule || null,
            nbStagiaires: 0,
            nbSessions: 0,
            nbHeuresRealisees: 0,
            caHT: 0,
        };

        existing.nbSessions++;

        const dossiersSession = session.dossiers?.filter(
            (d: any) => STATUS_ACTIFS.includes(d.status),
        ) || [];

        existing.nbStagiaires += dossiersSession.length;
        existing.nbHeuresRealisees += dossiersSession.length * prog.dureeHeures;

        for (const d of dossiersSession) {
            for (const c of d.contrats || []) {
                existing.caHT += toNumber(c.montantHT);
            }
        }

        programmesMap.set(prog.id, existing);
    }

    const actionsFormation = Array.from(programmesMap.values())
        .map(a => ({
            ...a,
            caHT: Math.round(a.caHT * 100) / 100,
        }))
        .sort((a, b) => b.nbStagiaires - a.nbStagiaires);

    if (totalStagiaires === 0) {
        alertes.push('⚠️ Aucun stagiaire actif sur l\'exercice — le BPF sera vide.');
    }

    return {
        totalStagiaires,
        stagiairesParFinanceur,
        stagiairesParPublic,
        totalHeuresDispensees: Math.round(totalHeuresDispensees * 10) / 10,
        heuresParModalite,
        totalSessions,
        sessionsTerminees,
        sessionsEnCours,
        sessionsAbandonnees,
        tauxAssiduiteGlobal,
        tauxReussite,
        nbCertificatsGeneres,
        actionsFormation,
    };
}

function computeSousTraitance(partners: any[], alertes: string[]): BPFSousTraitance {
    const activePartners = partners.filter(
        (p: any) => p.status === 'ACTIVE' || p.status === 'SUSPENDED',
    );

    const partnersWithoutConvention = activePartners.filter(
        (p: any) => !p.qualification?.conventionSignedAt,
    );

    if (partnersWithoutConvention.length > 0) {
        alertes.push(
            `🔴 ${partnersWithoutConvention.length} partenaire(s) actif(s) sans convention de sous-traitance signée. ` +
            'La DRIEETS vérifie systématiquement les conventions lors des contrôles.',
        );
    }

    return {
        confiee: {
            nbPartenaires: activePartners.length,
            partenaires: activePartners.map((p: any) => ({
                companyName: p.companyName,
                siret: p.siret,
                status: p.status,
                conventionSigned: !!p.qualification?.conventionSignedAt,
                totalLeads: p.totalLeadsSubmitted || 0,
            })),
        },
        recue: {
            mention: 'Non modélisé dans le système — à renseigner manuellement dans le Cerfa si applicable.',
        },
    };
}

// ─── Export texte (format papier Cerfa 10443) ─────────────────

/**
 * Génère l'export texte du BPF, structuré comme le formulaire Cerfa 10443.
 * Destiné à être imprimé ou archivé pour la DRIEETS.
 */
export function generateBPFTextExport(report: BPFReport): string {
    const sep = '═'.repeat(80);
    const thin = '─'.repeat(80);
    const lines: string[] = [];

    lines.push(sep);
    lines.push('  BILAN PÉDAGOGIQUE ET FINANCIER (BPF)');
    lines.push('  Formulaire Cerfa n° 10443*04');
    lines.push('  Art. L.6352-11 et R.6352-22 du Code du travail');
    lines.push(sep);
    lines.push('');

    // ── Cadre A — Identification ──────────────────────────────

    lines.push(thin);
    lines.push('  CADRE A — IDENTIFICATION DE L\'ORGANISME');
    lines.push(thin);
    const id = report.identification;
    lines.push(`  Raison sociale           : ${id.raisonSociale}`);
    lines.push(`  SIRET                    : ${id.siret}`);
    lines.push(`  N° Déclaration Activité  : ${id.ndaNumber || '❌ NON RENSEIGNÉ'}`);
    lines.push(`  Type d'organisme         : ${id.type}`);
    lines.push(`  Certification Qualiopi   : ${id.qualiopiCertified ? '✅ OUI' : '❌ NON'}`);
    if (id.qualiopiExpiry) {
        lines.push(`  Expiration Qualiopi      : ${new Date(id.qualiopiExpiry).toLocaleDateString('fr-FR')}`);
    }
    lines.push(`  Responsable              : ${id.responsableName || 'Non renseigné'}`);
    lines.push(`  Exercice                 : ${report.metadata.exercice}`);
    lines.push(`  Période                  : du ${formatDateFR(report.metadata.periodeDebut)} au ${formatDateFR(report.metadata.periodeFin)}`);
    lines.push('');

    // ── Cadre B — Bilan Financier ─────────────────────────────

    lines.push(thin);
    lines.push('  CADRE B — BILAN FINANCIER DE L\'ACTIVITÉ DE FORMATION');
    lines.push(thin);
    const bf = report.bilanFinancier;
    const pf = bf.produitsFormation;
    lines.push('');
    lines.push('  B1. Produits de l\'activité de formation :');
    lines.push(`    CA Total Formation               : ${formatMontant(pf.caTotal)}`);
    lines.push(`      dont OPCO                      : ${formatMontant(pf.caOPCO)} (${pct(pf.caOPCO, pf.caTotal)}%)`);
    lines.push(`      dont CPF (Caisse des Dépôts)   : ${formatMontant(pf.caCPF)} (${pct(pf.caCPF, pf.caTotal)}%)`);
    lines.push(`      dont Entreprise directe        : ${formatMontant(pf.caEntreprise)} (${pct(pf.caEntreprise, pf.caTotal)}%)`);
    lines.push(`      dont Individuel                : ${formatMontant(pf.caIndividuel)} (${pct(pf.caIndividuel, pf.caTotal)}%)`);
    lines.push(`      dont Mixte                     : ${formatMontant(pf.caMixte)} (${pct(pf.caMixte, pf.caTotal)}%)`);
    lines.push('');
    lines.push('  B2. Conventions et Contrats :');
    lines.push(`    Nombre de conventions signées    : ${bf.nbConventions}`);
    lines.push(`    Nombre de contrats signés        : ${bf.nbContrats}`);
    lines.push(`    Total documents contractuels     : ${bf.nbConventions + bf.nbContrats}`);
    lines.push('');
    lines.push('  B3. Facturation :');
    lines.push(`    Montant total facturé            : ${formatMontant(bf.montantFacture)}`);
    lines.push(`    Taux de facturation              : ${bf.tauxFacturation}%`);
    lines.push('');

    // ── Cadre C — Bilan Pédagogique ───────────────────────────

    lines.push(thin);
    lines.push('  CADRE C — BILAN PÉDAGOGIQUE');
    lines.push(thin);
    const bp = report.bilanPedagogique;
    lines.push('');
    lines.push('  C1. Nombre de stagiaires :');
    lines.push(`    TOTAL STAGIAIRES                 : ${bp.totalStagiaires}`);
    lines.push('');
    lines.push('    Répartition par source de financement :');
    lines.push(`      OPCO                           : ${bp.stagiairesParFinanceur.opco}`);
    lines.push(`      CPF (Mon Compte Formation)     : ${bp.stagiairesParFinanceur.cpf}`);
    lines.push(`      Entreprise directe             : ${bp.stagiairesParFinanceur.entreprise}`);
    lines.push(`      Individuel (autofinancement)   : ${bp.stagiairesParFinanceur.personnel}`);
    lines.push(`      Mixte                          : ${bp.stagiairesParFinanceur.mixte}`);
    lines.push('');
    lines.push('    Répartition par catégorie de public :');
    for (const cat of bp.stagiairesParPublic) {
        if (cat.total > 0) {
            lines.push(`      ${cat.label.padEnd(40)} : ${cat.total}`);
        }
    }
    lines.push('');

    lines.push('  C2. Heures de formation dispensées :');
    lines.push(`    TOTAL HEURES                     : ${bp.totalHeuresDispensees}h`);
    lines.push(`      Présentiel                     : ${bp.heuresParModalite.presentiel}h`);
    lines.push(`      FOAD (Formation à distance)    : ${bp.heuresParModalite.foad}h`);
    lines.push(`      Mixte (Blended)                : ${bp.heuresParModalite.mixte}h`);
    lines.push('');

    lines.push('  C3. Sessions de formation :');
    lines.push(`    Total sessions                   : ${bp.totalSessions}`);
    lines.push(`      Terminées / Clôturées          : ${bp.sessionsTerminees}`);
    lines.push(`      En cours                       : ${bp.sessionsEnCours}`);
    lines.push(`      Abandonnées                    : ${bp.sessionsAbandonnees}`);
    lines.push('');

    lines.push('  C4. Indicateurs qualité :');
    lines.push(`    Taux d'assiduité global          : ${bp.tauxAssiduiteGlobal}%`);
    lines.push(`    Taux de réussite (achèvement)    : ${bp.tauxReussite}%`);
    lines.push(`    Certificats de réalisation       : ${bp.nbCertificatsGeneres} / ${bp.totalStagiaires}`);
    lines.push('');

    // Actions de formation détaillées
    if (bp.actionsFormation.length > 0) {
        lines.push('  C5. Détail des actions de formation :');
        lines.push('');
        lines.push('    ' + 'Réf.'.padEnd(12) + 'Intitulé'.padEnd(32) + 'Stag.'.padStart(6) + 'Sess.'.padStart(6) + 'Heures'.padStart(8) + 'CA HT'.padStart(12));
        lines.push('    ' + '─'.repeat(76));
        for (const a of bp.actionsFormation) {
            const ref = a.reference.substring(0, 10).padEnd(12);
            const titre = a.intitule.substring(0, 30).padEnd(32);
            const stag = String(a.nbStagiaires).padStart(6);
            const sess = String(a.nbSessions).padStart(6);
            const heures = `${a.nbHeuresRealisees}h`.padStart(8);
            const ca = formatMontant(a.caHT).padStart(12);
            lines.push(`    ${ref}${titre}${stag}${sess}${heures}${ca}`);
            if (a.certificationCode) {
                lines.push(`    ${''.padEnd(12)}↳ Cert. ${a.certificationCode} — ${a.certificationIntitule || ''}`);
            }
        }
        lines.push('');
    }

    // ── Cadre D — Sous-traitance ──────────────────────────────

    lines.push(thin);
    lines.push('  CADRE D — SOUS-TRAITANCE');
    lines.push(thin);
    const st = report.sousTraitance;
    lines.push('');
    lines.push('  D1. Sous-traitance confiée :');
    lines.push(`    Nombre de partenaires            : ${st.confiee.nbPartenaires}`);
    if (st.confiee.partenaires.length > 0) {
        lines.push('');
        for (const p of st.confiee.partenaires) {
            const convIcon = p.conventionSigned ? '✅' : '❌';
            lines.push(`    • ${p.companyName} (SIRET: ${p.siret || 'n/a'}) — ${p.status}`);
            lines.push(`      Convention signée: ${convIcon}  |  Leads soumis: ${p.totalLeads}`);
        }
    }
    lines.push('');
    lines.push('  D2. Sous-traitance reçue :');
    lines.push(`    ${st.recue.mention}`);
    lines.push('');

    // ── Alertes ───────────────────────────────────────────────

    if (report.alertes.length > 0) {
        lines.push(thin);
        lines.push('  ALERTES ET RECOMMANDATIONS');
        lines.push(thin);
        for (const a of report.alertes) {
            lines.push(`  ${a}`);
        }
        lines.push('');
    }

    // ── Pied de page ──────────────────────────────────────────

    lines.push(sep);
    lines.push('  Ce document est un pré-remplissage automatisé du BPF (Cerfa 10443).');
    lines.push('  Il doit être vérifié, complété et signé par le responsable avant');
    lines.push('  transmission à la DRIEETS compétente.');
    lines.push('');
    lines.push(`  Référence interne : ${report.metadata.reference}`);
    lines.push(`  Généré le ${formatDateFR(report.metadata.generatedAt)} par ${report.metadata.generatedBy}`);
    lines.push(`  Version : ${report.metadata.version}`);
    lines.push(sep);

    return lines.join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────

function formatDateFR(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
}

function formatMontant(val: number): string {
    return val.toLocaleString('fr-FR', {
        style: 'currency', currency: 'EUR',
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
}

function pct(part: number, total: number): string {
    if (total === 0) return '0';
    return Math.round((part / total) * 100).toString();
}
