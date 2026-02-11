/**
 * TEMPLATES PAR DEFAUT — Contrat, DPA et CGV
 * =============================================
 * Ces templates sont injectés en base lors de la première utilisation
 * si l'organisme n'a pas encore personnalisé ses modèles.
 *
 * FORMAT DES SECTIONS :
 *   Chaque section a un `title` et un `content` (texte brut avec variables).
 *   Les variables sont entre doubles accolades : {{variable}}
 *
 * VARIABLES DISPONIBLES :
 *   Organisation : {{org.name}}, {{org.siret}}, {{org.address}}, {{org.city}},
 *                  {{org.responsable}}, {{org.nda}}
 *   Partenaire :   {{partner.companyName}}, {{partner.siret}}, {{partner.siren}},
 *                  {{partner.formeJuridique}}, {{partner.capitalSocial}},
 *                  {{partner.adresse}}, {{partner.codePostal}}, {{partner.ville}},
 *                  {{partner.pays}}, {{partner.rcs}}, {{partner.tvaIntracom}},
 *                  {{partner.representantNom}}, {{partner.representantFonction}},
 *                  {{partner.contactName}}, {{partner.contactEmail}},
 *                  {{partner.commissionRate}}, {{partner.rateLimit}},
 *                  {{partner.iban}}, {{partner.bic}}
 *   Dates :        {{date.today}}, {{date.expiryOneYear}}
 */

export interface TemplateSection {
    title: string;
    content: string;
}

export interface DefaultTemplate {
    type: 'CONTRACT' | 'DPA' | 'CGV';
    title: string;
    sections: TemplateSection[];
    footerText: string;
    variables: Record<string, string>; // description de chaque variable
}

// ══════════════════════════════════════════════════════════════
// VARIABLES — Descriptions pour l'UI d'administration
// ══════════════════════════════════════════════════════════════

export const AVAILABLE_VARIABLES: Record<string, string> = {
    // Organisation
    '{{org.name}}': 'Raison sociale de l\'organisme',
    '{{org.siret}}': 'SIRET de l\'organisme',
    '{{org.address}}': 'Adresse complète de l\'organisme',
    '{{org.city}}': 'Ville de l\'organisme',
    '{{org.responsable}}': 'Nom du responsable de l\'organisme',
    '{{org.nda}}': 'N° de déclaration d\'activité (NDA)',
    // Partenaire
    '{{partner.companyName}}': 'Raison sociale du partenaire',
    '{{partner.formeJuridique}}': 'Forme juridique (SAS, SARL...)',
    '{{partner.capitalSocial}}': 'Capital social en euros',
    '{{partner.siret}}': 'SIRET du partenaire',
    '{{partner.siren}}': 'SIREN du partenaire',
    '{{partner.rcs}}': 'RCS du partenaire',
    '{{partner.tvaIntracom}}': 'N° TVA intracommunautaire',
    '{{partner.adresse}}': 'Adresse du siège social',
    '{{partner.codePostal}}': 'Code postal du siège',
    '{{partner.ville}}': 'Ville du siège',
    '{{partner.pays}}': 'Pays du siège',
    '{{partner.representantNom}}': 'Nom du représentant légal',
    '{{partner.representantFonction}}': 'Fonction du représentant légal',
    '{{partner.contactName}}': 'Nom du contact opérationnel',
    '{{partner.contactEmail}}': 'Email du contact opérationnel',
    '{{partner.commissionRate}}': 'Taux de commission (%)',
    '{{partner.rateLimit}}': 'Limite de requêtes par heure',
    '{{partner.iban}}': 'IBAN du partenaire',
    '{{partner.bic}}': 'BIC/SWIFT du partenaire',
    // Dates
    '{{date.today}}': 'Date du jour (format JJ/MM/AAAA)',
    '{{date.expiryOneYear}}': 'Date dans un an (format JJ/MM/AAAA)',
};

// ══════════════════════════════════════════════════════════════
// CONTRAT DE PARTENARIAT API
// ══════════════════════════════════════════════════════════════

export const DEFAULT_CONTRACT: DefaultTemplate = {
    type: 'CONTRACT',
    title: 'Contrat de Partenariat API — Fourniture de Leads',
    sections: [
        {
            title: 'ENTRE LES SOUSSIGNÉS',
            content: `D'une part,

{{org.name}}, immatriculée sous le numéro SIRET {{org.siret}}, dont le siège social est situé {{org.address}}, représentée par {{org.responsable}} en sa qualité de Directeur(trice), ci-après dénommé « l'ORGANISME » ou « le Donneur d'Ordre »,

Titulaire du Numéro de Déclaration d'Activité (NDA) : {{org.nda}},

D'autre part,

{{partner.companyName}}, {{partner.formeJuridique}} au capital de {{partner.capitalSocial}} €, immatriculée au RCS {{partner.rcs}}, sous le numéro SIRET {{partner.siret}} (SIREN : {{partner.siren}}), dont le siège social est situé {{partner.adresse}}, {{partner.codePostal}} {{partner.ville}}, {{partner.pays}}, représentée par {{partner.representantNom}} en sa qualité de {{partner.representantFonction}}, ci-après dénommée « le PARTENAIRE » ou « le Fournisseur de Leads »,

(Ensemble dénommées les « Parties »)

IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :`,
        },
        {
            title: 'Article 1 — Objet du contrat',
            content: `Le présent contrat a pour objet de définir les conditions dans lesquelles le Partenaire fournit à l'Organisme des leads qualifiés (contacts de prospects intéressés par des formations) via l'API mise à disposition par l'Organisme.

Le Partenaire s'engage à transmettre des leads conformes aux critères de qualité définis à l'Article 4, via les endpoints techniques documentés et sécurisés par clé API.`,
        },
        {
            title: 'Article 2 — Durée du contrat',
            content: `Le présent contrat est conclu pour une durée de douze (12) mois à compter de sa date de signature, soit du {{date.today}} au {{date.expiryOneYear}}.

Il se renouvellera ensuite par tacite reconduction pour des périodes successives de douze (12) mois, sauf dénonciation par l'une des Parties adressée par lettre recommandée avec accusé de réception, avec un préavis de trois (3) mois avant le terme de la période en cours.`,
        },
        {
            title: 'Article 3 — Accès technique (API)',
            content: `L'Organisme met à disposition du Partenaire un accès API sécurisé, dont les modalités sont les suivantes :

• Authentification : par clé API unique (pk_live_...) transmise de manière sécurisée après signature du présent contrat et du DPA
• Limitation de débit : {{partner.rateLimit}} requêtes par heure
• Documentation technique : accessible en ligne à l'adresse communiquée lors de l'activation
• Environnement : production (HTTPS obligatoire)
• Format des données : JSON conforme au schéma documenté

L'Organisme se réserve le droit de suspendre temporairement l'accès API en cas de maintenance ou de dépassement des quotas, sous réserve d'un préavis raisonnable.`,
        },
        {
            title: 'Article 4 — Qualité des leads',
            content: `Le Partenaire s'engage à transmettre des leads répondant aux critères suivants :

• Données obligatoires : nom, prénom, email, numéro de téléphone du prospect
• Consentement : le prospect doit avoir donné son consentement explicite pour être contacté par l'Organisme dans le cadre d'un projet de formation
• Véracité : les informations transmises doivent être exactes et vérifiées par le Partenaire
• Exclusivité : sauf accord contraire, un même lead ne peut être transmis simultanément à des organismes concurrents
• Fraîcheur : les leads doivent dater de moins de 72 heures au moment de leur transmission

Tout lead ne respectant pas ces critères pourra être refusé par l'Organisme et ne fera pas l'objet d'une rémunération.`,
        },
        {
            title: 'Article 5 — Rémunération et facturation',
            content: `En contrepartie de la fourniture de leads qualifiés, l'Organisme versera au Partenaire une commission de {{partner.commissionRate}}% calculée sur le chiffre d'affaires HT effectivement encaissé par l'Organisme, résultant directement de la conversion d'un lead fourni par le Partenaire.

Modalités de facturation :
• Le Partenaire adressera une facture mensuelle à l'Organisme
• Paiement à 30 jours fin de mois par virement bancaire
• Coordonnées bancaires du Partenaire : IBAN {{partner.iban}}, BIC {{partner.bic}}

L'Organisme s'engage à fournir au Partenaire un reporting mensuel détaillant le nombre de leads reçus, traités, convertis, et le montant des commissions dues.`,
        },
        {
            title: 'Article 6 — Obligations des parties',
            content: `Le Partenaire s'engage à :
• Respecter la réglementation en vigueur relative au démarchage commercial et à la prospection
• Obtenir le consentement des prospects conformément au RGPD avant tout transfert de données
• Maintenir la confidentialité de sa clé API
• Ne pas effectuer de reverse-engineering sur l'API de l'Organisme
• Informer immédiatement l'Organisme de toute violation de données

L'Organisme s'engage à :
• Traiter les leads reçus avec diligence dans un délai de 48 heures ouvrées
• Fournir une API fiable avec un taux de disponibilité minimum de 99,5% (hors maintenance planifiée)
• Communiquer au Partenaire le suivi des leads transmis
• Payer les commissions dues dans les délais convenus`,
        },
        {
            title: 'Article 7 — Propriété intellectuelle',
            content: `Chaque Partie conserve la propriété de ses droits de propriété intellectuelle propres.

Les leads transmis deviennent la propriété de l'Organisme dès leur réception et validation. Le Partenaire ne conserve aucun droit d'usage sur les leads après transmission.

L'utilisation de la marque, du logo ou du nom commercial de l'autre Partie est soumise à autorisation préalable écrite.`,
        },
        {
            title: 'Article 8 — Résiliation',
            content: `Chaque Partie peut résilier le présent contrat :

• De plein droit, en cas de manquement grave de l'autre Partie à ses obligations, après mise en demeure restée sans effet pendant 15 jours
• En cas de procédure collective (redressement ou liquidation judiciaire)
• À tout moment, moyennant un préavis de 3 mois notifié par LRAR

En cas de résiliation, la clé API du Partenaire sera immédiatement désactivée. Les commissions dues pour les leads déjà convertis resteront exigibles.`,
        },
        {
            title: 'Article 9 — Confidentialité',
            content: `Les Parties s'engagent mutuellement à garder strictement confidentiels l'ensemble des informations, documents, données et savoir-faire dont elles auraient pu avoir connaissance à l'occasion de l'exécution du présent contrat.

Cette obligation de confidentialité est valable pendant toute la durée du contrat et pendant une période de deux (2) ans suivant son expiration.`,
        },
        {
            title: 'Article 10 — Droit applicable et juridiction',
            content: `Le présent contrat est soumis au droit français.

En cas de litige relatif à l'interprétation ou à l'exécution du présent contrat, les Parties s'engagent à rechercher une solution amiable. À défaut d'accord, le litige sera soumis au Tribunal de Commerce du lieu du siège social de l'Organisme.

Fait en deux exemplaires numériques, à {{org.city}}, le {{date.today}}.`,
        },
        {
            title: 'Signatures',
            content: `Pour l'Organisme :
{{org.responsable}}
{{org.name}}

Pour le Partenaire :
{{partner.representantNom}}, {{partner.representantFonction}}
{{partner.companyName}}`,
        },
    ],
    footerText: 'Contrat de Partenariat API — {{org.name}} × {{partner.companyName}} — Page {{page}} / {{pages}}',
    variables: AVAILABLE_VARIABLES,
};

// ══════════════════════════════════════════════════════════════
// DPA — DATA PROCESSING AGREEMENT (RGPD Art. 28)
// ══════════════════════════════════════════════════════════════

export const DEFAULT_DPA: DefaultTemplate = {
    type: 'DPA',
    title: 'Accord sur le Traitement des Données Personnelles (DPA)',
    sections: [
        {
            title: 'ENTRE LES SOUSSIGNÉS',
            content: `{{org.name}}, SIRET {{org.siret}}, dont le siège social est situé {{org.address}}, représentée par {{org.responsable}}, ci-après dénommée « le Responsable de Traitement »,

ET

{{partner.companyName}}, {{partner.formeJuridique}} au capital de {{partner.capitalSocial}} €, SIRET {{partner.siret}}, dont le siège social est situé {{partner.adresse}}, {{partner.codePostal}} {{partner.ville}}, représentée par {{partner.representantNom}}, {{partner.representantFonction}}, ci-après dénommée « le Sous-Traitant »,

Conformément à l'article 28 du Règlement (UE) 2016/679 du 27 avril 2016 (RGPD).`,
        },
        {
            title: 'Article 1 — Objet et périmètre',
            content: `Le présent accord définit les conditions dans lesquelles le Sous-Traitant (Partenaire) collecte et transmet des données personnelles de prospects au Responsable de Traitement (Organisme) dans le cadre du Contrat de Partenariat API.

Nature du traitement : collecte, transmission et stockage de données de prospects de formation
Finalité : mise en relation de prospects avec l'Organisme pour des projets de formation professionnelle
Base légale : consentement explicite du prospect (Art. 6.1.a RGPD) et intérêt légitime (Art. 6.1.f)`,
        },
        {
            title: 'Article 2 — Catégories de données traitées',
            content: `Les données personnelles transmises via l'API incluent :

Données d'identification :
• Nom et prénom
• Adresse email
• Numéro de téléphone

Données relatives au projet de formation :
• Domaine de formation souhaité
• Niveau d'études actuel
• Situation professionnelle (demandeur d'emploi, salarié, etc.)
• Éligibilité aux dispositifs de financement (CPF, OPCO, etc.)

Données techniques :
• Date et heure de la soumission
• Adresse IP source (à des fins d'audit)
• Identifiant de la source (campagne, partenaire)

AUCUNE donnée sensible au sens de l'Article 9 du RGPD (santé, opinions politiques, orientation sexuelle, etc.) ne doit être transmise.`,
        },
        {
            title: 'Article 3 — Personnes concernées',
            content: `Les personnes dont les données sont traitées sont :
• Des personnes physiques majeures résidant en France ou dans l'Union Européenne
• Ayant exprimé un intérêt pour une formation professionnelle
• Ayant donné leur consentement explicite au traitement de leurs données`,
        },
        {
            title: 'Article 4 — Obligations du Sous-Traitant (Partenaire)',
            content: `Le Sous-Traitant s'engage à :

a) Consentement : recueillir le consentement libre, spécifique, éclairé et univoque de chaque prospect avant toute transmission de ses données. Ce consentement doit être documenté et auditable.

b) Information : informer chaque prospect, au moment de la collecte, de :
   - L'identité du Responsable de Traitement ({{org.name}})
   - La finalité du traitement (mise en relation pour un projet de formation)
   - Ses droits (accès, rectification, effacement, portabilité, opposition)
   - La durée de conservation des données

c) Sécurité : mettre en œuvre les mesures techniques et organisationnelles suivantes :
   - Chiffrement des données en transit (TLS 1.2+)
   - Authentification par clé API avec hachage SHA-256
   - Limitation des accès aux personnels habilités
   - Journalisation des transmissions

d) Sous-traitance : ne pas recourir à un autre sous-traitant sans l'accord préalable écrit du Responsable de Traitement.

e) Coopération : assister le Responsable de Traitement dans le cadre de l'exercice des droits des personnes concernées.

f) Notification : informer le Responsable de Traitement dans un délai de 72 heures en cas de violation de données personnelles.`,
        },
        {
            title: 'Article 5 — Obligations du Responsable de Traitement (Organisme)',
            content: `Le Responsable de Traitement s'engage à :

a) Traiter les données collectées uniquement pour la finalité prévue au présent accord
b) Mettre en œuvre les mesures de sécurité appropriées pour protéger les données
c) Respecter les droits des personnes concernées (accès, rectification, effacement)
d) Tenir un registre des traitements conformément à l'Article 30 du RGPD
e) Désigner un Délégué à la Protection des Données (DPO) si applicable`,
        },
        {
            title: 'Article 6 — Durée de conservation',
            content: `Les données des prospects sont conservées par le Responsable de Traitement pour les durées suivantes :

• Leads non convertis : 12 mois maximum à compter de la réception, puis anonymisation ou suppression
• Leads convertis en dossier de formation : durée de la relation contractuelle + 3 ans (obligations légales)
• Logs d'audit API : 24 mois (sécurité et conformité)

À l'expiration de ces délais, les données sont supprimées de manière irréversible ou anonymisées.`,
        },
        {
            title: 'Article 7 — Transferts de données',
            content: `Les données personnelles sont traitées et stockées exclusivement au sein de l'Union Européenne.

Tout transfert de données vers un pays tiers ne disposant pas d'une décision d'adéquation est interdit, sauf mise en place de garanties appropriées (clauses contractuelles types de la Commission européenne).`,
        },
        {
            title: 'Article 8 — Audit et contrôle',
            content: `Le Responsable de Traitement se réserve le droit de procéder ou de faire procéder à des audits de conformité, sur préavis de 15 jours ouvrés, afin de vérifier le respect des obligations du présent accord.

Le Sous-Traitant s'engage à coopérer pleinement et à fournir toute information nécessaire à la réalisation de cet audit.`,
        },
        {
            title: 'Article 9 — Sort des données en fin de contrat',
            content: `À l'expiration ou à la résiliation du Contrat de Partenariat API, le Sous-Traitant s'engage à :

• Cesser immédiatement tout traitement de données pour le compte du Responsable de Traitement
• Restituer l'ensemble des données personnelles détenues au format convenu dans un délai de 30 jours
• Supprimer de manière irréversible toute copie des données personnelles dans un délai de 60 jours
• Fournir un certificat de destruction au Responsable de Traitement`,
        },
        {
            title: 'Article 10 — Responsabilité et sanctions',
            content: `Chaque Partie est responsable de sa propre conformité au RGPD.

En cas de manquement du Sous-Traitant à ses obligations au titre du présent accord, le Responsable de Traitement pourra :
• Suspendre immédiatement l'accès API
• Résilier le Contrat de Partenariat de plein droit
• Engager des poursuites judiciaires et réclamer des dommages-intérêts

Conformément à l'Article 82 du RGPD, chaque Partie est responsable du dommage causé par son propre manquement.

Fait en deux exemplaires numériques, le {{date.today}}.`,
        },
        {
            title: 'Signatures',
            content: `Pour le Responsable de Traitement :
{{org.responsable}}
{{org.name}}

Pour le Sous-Traitant :
{{partner.representantNom}}, {{partner.representantFonction}}
{{partner.companyName}}`,
        },
    ],
    footerText: 'DPA (RGPD Art. 28) — {{org.name}} × {{partner.companyName}} — Confidentiel — Page {{page}} / {{pages}}',
    variables: AVAILABLE_VARIABLES,
};

// ══════════════════════════════════════════════════════════════
// EXPORT — Tous les templates
// ══════════════════════════════════════════════════════════════

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
    DEFAULT_CONTRACT,
    DEFAULT_DPA,
];
