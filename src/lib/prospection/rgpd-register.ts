/**
 * REGISTRE DES TRAITEMENTS — Article 30 RGPD
 * =============================================
 * Génère un registre formalisé des activités de traitement
 * conforme aux exigences de l'Article 30 du RGPD et aux
 * recommandations de la CNIL.
 * 
 * Le registre documente pour chaque traitement :
 *   - Finalité(s) du traitement
 *   - Catégories de données et de personnes concernées
 *   - Destinataires et sous-traitants
 *   - Durée de conservation
 *   - Mesures de sécurité techniques et organisationnelles
 *   - Base légale
 *   - Transferts hors UE éventuels
 * 
 * Référence : https://www.cnil.fr/fr/RGDP-le-registre-des-activites-de-traitement
 * 
 * @Compliance: RGPD Art. 30, Qualiopi Indicateur 17
 */

import { prisma as defaultPrisma } from '@/lib/prisma';

// Instance injectable (pour les tests)
let prismaInstance: any = null;

export function setPrismaInstance(instance: any): void {
    prismaInstance = instance;
}

function getPrisma(): any {
    return prismaInstance || defaultPrisma;
}

// ─── Types ────────────────────────────────────────────────────

export interface TreatmentEntry {
    id: string;
    name: string;
    description: string;
    purpose: string[];
    legalBasis: string;
    legalBasisDetail: string;
    dataCategories: DataCategory[];
    dataConcernedPersons: string[];
    recipients: RecipientEntry[];
    retentionPeriod: string;
    retentionDetail: string;
    securityMeasures: string[];
    transfersOutsideEU: TransferEntry[];
    dpia: DPIAStatus;
    lastReviewDate: string;
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING_REVIEW';
}

export interface DataCategory {
    category: string;
    fields: string[];
    sensitivity: 'STANDARD' | 'SENSITIVE' | 'HIGHLY_SENSITIVE';
}

export interface RecipientEntry {
    name: string;
    type: 'INTERNAL' | 'SUBPROCESSOR' | 'PARTNER' | 'AUTHORITY';
    dpaStatus: 'SIGNED' | 'PENDING' | 'NOT_REQUIRED';
    country: string;
}

export interface TransferEntry {
    country: string;
    mechanism: string;
    recipient: string;
}

export interface DPIAStatus {
    required: boolean;
    completed: boolean;
    completedAt?: string;
    reference?: string;
}

export interface RGPDRegister {
    metadata: RegisterMetadata;
    controller: ControllerInfo;
    dpo: DPOInfo;
    treatments: TreatmentEntry[];
    generatedAt: string;
    version: string;
}

export interface RegisterMetadata {
    organizationId: string;
    organizationName: string;
    registerVersion: string;
    lastUpdate: string;
    generatedBy: string;
    cnilReference: string;
}

export interface ControllerInfo {
    name: string;
    siret?: string;
    address: string;
    representant: string;
    contactEmail: string;
}

export interface DPOInfo {
    designated: boolean;
    name?: string;
    email?: string;
    phone?: string;
}

// ─── Traitements statiques (déclaratifs) ──────────────────────

/**
 * Descriptions des traitements fixes du système.
 * Ces traitements sont inhérents au fonctionnement de la plateforme ERP.
 */
const STATIC_TREATMENTS: Omit<TreatmentEntry, 'id'>[] = [
    {
        name: 'Gestion des dossiers de formation',
        description: 'Traitement des données des apprenants dans le cadre de la gestion administrative et pédagogique des formations professionnelles (Qualiopi).',
        purpose: [
            'Inscription et suivi des apprenants',
            'Gestion administrative des dossiers de formation',
            'Émission des attestations et certificats',
            'Suivi des indicateurs Qualiopi',
            'Facturation et gestion financière',
        ],
        legalBasis: 'Exécution du contrat (Art. 6.1.b)',
        legalBasisDetail: 'Le traitement est nécessaire à l\'exécution du contrat de formation signé avec l\'apprenant ou son employeur.',
        dataCategories: [
            {
                category: 'Identité',
                fields: ['Nom', 'Prénom', 'Date de naissance', 'Lieu de naissance', 'Nationalité'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Coordonnées',
                fields: ['Adresse postale', 'Email', 'Téléphone'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données professionnelles',
                fields: ['Employeur', 'Poste occupé', 'Niveau de qualification'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données pédagogiques',
                fields: ['Formation suivie', 'Résultats', 'Assiduité', 'Évaluations'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données financières',
                fields: ['Mode de financement', 'OPCO', 'Numéro de prise en charge'],
                sensitivity: 'STANDARD',
            },
        ],
        dataConcernedPersons: ['Apprenants / Stagiaires', 'Employeurs / Entreprises'],
        recipients: [
            { name: 'Personnel administratif (interne)', type: 'INTERNAL', dpaStatus: 'NOT_REQUIRED', country: 'France' },
            { name: 'Formateurs (internes)', type: 'INTERNAL', dpaStatus: 'NOT_REQUIRED', country: 'France' },
            { name: 'OPCO / France Compétences', type: 'AUTHORITY', dpaStatus: 'NOT_REQUIRED', country: 'France' },
            { name: 'Certificateurs (RNCP)', type: 'AUTHORITY', dpaStatus: 'NOT_REQUIRED', country: 'France' },
        ],
        retentionPeriod: '5 ans après la fin de la formation',
        retentionDetail: 'Conformément à l\'article L6313-8 du Code du travail et aux exigences Qualiopi. Les données financières sont conservées 10 ans (obligation comptable).',
        securityMeasures: [
            'Chiffrement des données en transit (TLS 1.3)',
            'Contrôle d\'accès par rôle (RBAC)',
            'Journal d\'audit des actions',
            'Authentification forte des utilisateurs',
            'Sauvegarde quotidienne chiffrée',
            'Hébergement certifié HDS/ISO 27001',
        ],
        transfersOutsideEU: [],
        dpia: { required: false, completed: false },
        lastReviewDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
    },
    {
        name: 'Prospection commerciale — Gestion des leads',
        description: 'Collecte et traitement des données de prospects intéressés par les formations, via les canaux directs (site web, formulaires) et les partenaires apporteurs d\'affaires.',
        purpose: [
            'Collecte de leads qualifiés',
            'Qualification et scoring des prospects',
            'Relance commerciale et suivi',
            'Mesure de la performance des campagnes',
            'Attribution des leads aux commerciaux',
        ],
        legalBasis: 'Consentement (Art. 6.1.a)',
        legalBasisDetail: 'Le traitement est fondé sur le consentement explicite du prospect, recueilli au moment de la soumission du formulaire (case à cocher ou consentement API partenaire).',
        dataCategories: [
            {
                category: 'Identité',
                fields: ['Nom', 'Prénom'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Coordonnées',
                fields: ['Email', 'Téléphone', 'Adresse', 'Code postal', 'Ville'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données de prospection',
                fields: ['Formation souhaitée', 'Message', 'Source du lead', 'Score', 'Statut'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données techniques',
                fields: ['Adresse IP', 'User-Agent', 'Date de consentement', 'Méthode de consentement'],
                sensitivity: 'STANDARD',
            },
        ],
        dataConcernedPersons: ['Prospects / Candidats à la formation'],
        recipients: [
            { name: 'Équipe commerciale (interne)', type: 'INTERNAL', dpaStatus: 'NOT_REQUIRED', country: 'France' },
        ],
        retentionPeriod: '36 mois après le dernier contact',
        retentionDetail: 'Conformément à la recommandation CNIL (Délibération n° 2019-131). Anonymisation automatique via CRON quotidien. Droit à l\'effacement exercable via API /api/rgpd/leads.',
        securityMeasures: [
            'Chiffrement des données en transit (TLS 1.3)',
            'Anonymisation automatique après 36 mois',
            'CRON quotidien de purge',
            'API de droits RGPD (export, effacement, retrait consentement)',
            'Contrôle d\'accès RBAC (ADMIN/RESP_ADMIN pour les actions RGPD)',
            'Journal d\'audit de toutes les actions RGPD',
        ],
        transfersOutsideEU: [],
        dpia: { required: false, completed: false },
        lastReviewDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
    },
    {
        name: 'Sous-traitance — Partenaires apporteurs d\'affaires',
        description: 'Gestion des relations avec les partenaires externes qui soumettent des leads via l\'API. Inclut le contrôle de conformité (DPA, contrats) et la traçabilité des échanges.',
        purpose: [
            'Gestion des partenaires apporteurs d\'affaires',
            'Contrôle de conformité contractuelle et RGPD',
            'Suivi des performances partenaires',
            'Traçabilité des actions (Qualiopi Ind. 17/26)',
        ],
        legalBasis: 'Intérêt légitime (Art. 6.1.f)',
        legalBasisDetail: 'Le traitement est nécessaire aux fins des intérêts légitimes du responsable de traitement (gestion de la sous-traitance, respect des obligations Qualiopi).',
        dataCategories: [
            {
                category: 'Identité entreprise',
                fields: ['Raison sociale', 'SIRET', 'Adresse du siège', 'Représentant légal'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Coordonnées du contact',
                fields: ['Nom du contact', 'Email', 'Téléphone'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données contractuelles',
                fields: ['Date signature contrat', 'Date expiration', 'Date signature DPA', 'Date signature NDA', 'Taux de commission'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données techniques',
                fields: ['Clé API (hashée)', 'Préfixe de clé', 'Rate limit', 'IP whitelist'],
                sensitivity: 'STANDARD',
            },
        ],
        dataConcernedPersons: ['Représentants légaux des partenaires', 'Contacts opérationnels des partenaires'],
        recipients: [
            { name: 'Direction et gestion (interne)', type: 'INTERNAL', dpaStatus: 'NOT_REQUIRED', country: 'France' },
        ],
        retentionPeriod: 'Durée du contrat + 5 ans',
        retentionDetail: 'Les données des partenaires sont conservées pendant la durée du contrat et 5 ans après sa résiliation (prescription civile). Les journaux d\'audit sont conservés 10 ans.',
        securityMeasures: [
            'Vérification obligatoire DPA avant ingestion de leads',
            'Vérification de la validité du contrat à chaque requête',
            'Hachage SHA-256 des clés API',
            'Journal d\'audit dédié (PartnerAuditLog)',
            'Contrôle des IP (whitelist configurable)',
            'Rate limiting par partenaire',
            'Rapport de conformité générable par partenaire',
        ],
        transfersOutsideEU: [],
        dpia: { required: false, completed: false },
        lastReviewDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
    },
    {
        name: 'Gestion des utilisateurs et authentification',
        description: 'Gestion des comptes utilisateurs de la plateforme ERP, authentification, et contrôle d\'accès basé sur les rôles (RBAC).',
        purpose: [
            'Authentification sécurisée des utilisateurs',
            'Gestion des rôles et permissions (RBAC)',
            'Traçabilité des connexions et actions',
            'Gestion multi-tenant (organisations)',
        ],
        legalBasis: 'Exécution du contrat (Art. 6.1.b)',
        legalBasisDetail: 'Le traitement est nécessaire à l\'exécution du contrat SaaS avec l\'organisme de formation.',
        dataCategories: [
            {
                category: 'Identité',
                fields: ['Nom', 'Prénom', 'Email'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données de connexion',
                fields: ['Hash du mot de passe', 'Dernière connexion', 'Adresse IP de connexion'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données de rôle',
                fields: ['Rôle attribué', 'Organisation', 'Permissions'],
                sensitivity: 'STANDARD',
            },
        ],
        dataConcernedPersons: ['Employés / agents de l\'organisme de formation', 'Administrateurs systèmes'],
        recipients: [
            { name: 'Administrateur technique (interne)', type: 'INTERNAL', dpaStatus: 'NOT_REQUIRED', country: 'France' },
        ],
        retentionPeriod: 'Durée du compte + 1 an',
        retentionDetail: 'Les données de compte sont conservées pendant la durée de la relation contractuelle et 1 an après désactivation. Les logs de connexion sont conservés 6 mois.',
        securityMeasures: [
            'Hachage bcrypt des mots de passe',
            'Sessions JWT avec expiration',
            'Authentification multi-facteur disponible',
            'Verrouillage de compte après tentatives échouées',
            'Contrôle d\'accès RBAC granulaire',
        ],
        transfersOutsideEU: [],
        dpia: { required: false, completed: false },
        lastReviewDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
    },
    {
        name: 'Journal d\'audit et traçabilité',
        description: 'Enregistrement automatique de toutes les actions sensibles pour assurer la traçabilité réglementaire (Qualiopi, RGPD) et la sécurité du système.',
        purpose: [
            'Traçabilité des actions administratives',
            'Détection d\'anomalies de sécurité',
            'Conformité Qualiopi (preuve de processus)',
            'Conformité RGPD Art. 5.1.f (accountability)',
        ],
        legalBasis: 'Obligation légale (Art. 6.1.c)',
        legalBasisDetail: 'Le traitement est nécessaire au respect d\'obligations légales (Qualiopi, RGPD Art. 5.1.f — principe de responsabilité).',
        dataCategories: [
            {
                category: 'Données d\'audit',
                fields: ['Action effectuée', 'Entité modifiée', 'État précédent', 'Nouvel état', 'Horodatage'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données de traçabilité',
                fields: ['Identifiant utilisateur', 'Rôle', 'Adresse IP', 'User-Agent'],
                sensitivity: 'STANDARD',
            },
        ],
        dataConcernedPersons: ['Tous les utilisateurs de la plateforme'],
        recipients: [
            { name: 'Administrateurs (interne)', type: 'INTERNAL', dpaStatus: 'NOT_REQUIRED', country: 'France' },
            { name: 'Auditeurs qualité Qualiopi', type: 'AUTHORITY', dpaStatus: 'NOT_REQUIRED', country: 'France' },
        ],
        retentionPeriod: '10 ans',
        retentionDetail: 'Délai de prescription maximale. Les journaux d\'audit constituent des preuves de conformité Qualiopi et ne doivent pas être supprimés avant la fin des obligations de conservation.',
        securityMeasures: [
            'Écriture en append-only (non modifiable)',
            'Horodatage automatique',
            'Sauvegarde redondante',
            'Accès restreint aux administrateurs',
        ],
        transfersOutsideEU: [],
        dpia: { required: false, completed: false },
        lastReviewDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
    },
    {
        name: 'Communication WhatsApp — Messagerie et automatisations',
        description: 'Envoi de messages WhatsApp (transactionnels et marketing) aux apprenants et prospects via l\'API Meta Cloud ou Twilio. Inclut les messages automatiques (rappels, confirmations, relances) et les campagnes de broadcast.',
        purpose: [
            'Communication transactionnelle avec les apprenants (rappels session, confirmations)',
            'Communication marketing avec les prospects (relances, offres)',
            'Automatisations sur événements (changement statut dossier, création lead)',
            'Campagnes de diffusion groupée (broadcasts)',
            'Chatbot conversationnel pour l\'accueil et la qualification',
        ],
        legalBasis: 'Consentement (Art. 6.1.a) / Exécution du contrat (Art. 6.1.b)',
        legalBasisDetail: 'Base légale double : le consentement explicite du prospect (Art. 6.1.a) pour les messages marketing, et l\'exécution du contrat de formation (Art. 6.1.b) pour les messages transactionnels liés à un dossier.',
        dataCategories: [
            {
                category: 'Coordonnées',
                fields: ['Numéro de téléphone (WhatsApp)'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Contenu des échanges',
                fields: ['Contenu des messages envoyés', 'Contenu des messages reçus', 'Horodatage'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données techniques',
                fields: ['ID message fournisseur', 'Statut de livraison', 'Canal (WhatsApp/SMS)', 'Template utilisé'],
                sensitivity: 'STANDARD',
            },
            {
                category: 'Données de consentement',
                fields: ['Statut opt-in/opt-out', 'Date de désinscription', 'Méthode (STOP keyword)'],
                sensitivity: 'STANDARD',
            },
        ],
        dataConcernedPersons: ['Apprenants / Stagiaires', 'Prospects / Candidats à la formation'],
        recipients: [
            { name: 'Équipe commerciale (interne)', type: 'INTERNAL', dpaStatus: 'NOT_REQUIRED', country: 'France' },
            { name: 'Personnel administratif (interne)', type: 'INTERNAL', dpaStatus: 'NOT_REQUIRED', country: 'France' },
            { name: 'Meta Platforms Inc. (WhatsApp Business API)', type: 'SUBPROCESSOR', dpaStatus: 'SIGNED', country: 'États-Unis' },
        ],
        retentionPeriod: '36 mois après le dernier échange',
        retentionDetail: 'Les messages sont conservés 36 mois conformément à la politique de rétention des données. En cas d\'effacement (Art. 17), les contenus des messages sont anonymisés. L\'opt-out via mot-clé STOP est traité automatiquement.',
        securityMeasures: [
            'Vérification du consentement avant chaque envoi marketing (Art. 6.1.a)',
            'Mécanisme de désinscription automatique (mot-clé STOP — Art. 7.3)',
            'Audit trail de chaque message envoyé (AuditLog)',
            'Chiffrement de bout en bout (WhatsApp natif)',
            'Chiffrement en transit via TLS 1.3',
            'Anonymisation des messages lors de l\'effacement RGPD (Art. 17)',
            'Inclusion des messages dans l\'export de données (Art. 20)',
            'Contrôle d\'accès RBAC sur la configuration des automatisations',
        ],
        transfersOutsideEU: [
            {
                country: 'États-Unis',
                mechanism: 'Clauses Contractuelles Types (SCC) — Decision 2021/914/EU + DPA Meta',
                recipient: 'Meta Platforms Inc.',
            },
        ],
        dpia: { required: true, completed: false },
        lastReviewDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
    },
];

// ─── Génération dynamique du registre ─────────────────────────

/**
 * Génère le registre complet des traitements Art. 30 RGPD.
 * Combine les traitements statiques déclaratifs avec les données
 * dynamiques extraites de la base (partenaires, stats leads).
 */
export async function generateRegister(organizationId?: string): Promise<RGPDRegister> {
    // Récupérer les infos de l'organisation si spécifiée
    let orgInfo = {
        name: 'Organisme de Formation',
        id: organizationId || 'all',
    };

    if (organizationId) {
        try {
            const org = await getPrisma().organization.findUnique({
                where: { id: organizationId },
                select: { id: true, name: true },
            });
            if (org) {
                orgInfo = { name: org.name, id: org.id };
            }
        } catch {
            // Fallback aux valeurs par défaut
        }
    }

    // Enrichir le traitement "Partenaires" avec les sous-traitants réels
    const treatments = STATIC_TREATMENTS.map((t, index) => ({
        ...t,
        id: `TRT-${String(index + 1).padStart(3, '0')}`,
    }));

    // Injecter les partenaires réels comme destinataires du traitement leads
    if (organizationId) {
        try {
            const partners = await getPrisma().partner.findMany({
                where: { organizationId, status: 'ACTIVE' },
                select: {
                    companyName: true,
                    dpaSignedAt: true,
                    contractSignedAt: true,
                    contractExpiresAt: true,
                },
            });

            const partnerRecipients: RecipientEntry[] = partners.map((p: any) => ({
                name: p.companyName,
                type: 'SUBPROCESSOR' as const,
                dpaStatus: p.dpaSignedAt ? 'SIGNED' as const : 'PENDING' as const,
                country: 'France',
            }));

            // Ajouter au traitement "Prospection" (#2 → index 1)
            const prospectionTreatment = treatments[1];
            if (prospectionTreatment) {
                prospectionTreatment.recipients = [
                    ...prospectionTreatment.recipients,
                    ...partnerRecipients,
                ];
            }

            // Ajouter au traitement "Sous-traitance" (#3 → index 2)
            const partnerTreatment = treatments[2];
            if (partnerTreatment) {
                partnerTreatment.recipients = [
                    ...partnerTreatment.recipients,
                    ...partnerRecipients.map(r => ({
                        ...r,
                        type: 'PARTNER' as const,
                    })),
                ];
            }
        } catch {
            // Pas de partenaires ou erreur — format de base
        }
    }

    return {
        metadata: {
            organizationId: orgInfo.id,
            organizationName: orgInfo.name,
            registerVersion: '1.0.0',
            lastUpdate: new Date().toISOString(),
            generatedBy: 'Polyx ERP — Module RGPD Art. 30',
            cnilReference: 'Conforme au modèle CNIL v2 (2024)',
        },
        controller: {
            name: orgInfo.name,
            address: 'À compléter par le responsable de traitement',
            representant: 'À compléter par le responsable de traitement',
            contactEmail: 'À compléter par le responsable de traitement',
        },
        dpo: {
            designated: false,
            name: undefined,
            email: undefined,
            phone: undefined,
        },
        treatments,
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
    };
}

/**
 * Génère des statistiques de conformité agrégées
 * pour le dashboard (nombre de traitements, DPA manquants, etc.)
 */
export async function getRegisterStats(organizationId?: string) {
    const register = await generateRegister(organizationId);

    const activeTreatments = register.treatments.filter(t => t.status === 'ACTIVE');
    const allRecipients = activeTreatments.flatMap(t => t.recipients);
    const subProcessors = allRecipients.filter(r => r.type === 'SUBPROCESSOR' || r.type === 'PARTNER');
    const dpaPending = subProcessors.filter(r => r.dpaStatus === 'PENDING');
    const allDataCategories = activeTreatments.flatMap(t => t.dataCategories);
    const sensitiveCategories = allDataCategories.filter(c => c.sensitivity !== 'STANDARD');

    return {
        totalTreatments: register.treatments.length,
        activeTreatments: activeTreatments.length,
        totalRecipients: allRecipients.length,
        subProcessors: subProcessors.length,
        dpaSigned: subProcessors.filter(r => r.dpaStatus === 'SIGNED').length,
        dpaPending: dpaPending.length,
        dpaPendingNames: dpaPending.map(r => r.name),
        totalDataCategories: allDataCategories.length,
        sensitiveDataCategories: sensitiveCategories.length,
        transfersOutsideEU: activeTreatments.reduce(
            (sum, t) => sum + t.transfersOutsideEU.length, 0,
        ),
        dpiaRequired: activeTreatments.filter(t => t.dpia.required).length,
        dpiaCompleted: activeTreatments.filter(t => t.dpia.completed).length,
        lastUpdate: register.metadata.lastUpdate,
        controllerConfigured: register.controller.representant !== 'À compléter par le responsable de traitement',
        dpoDesignated: register.dpo.designated,
    };
}
