/**
 * CHATBOT DEFAULT RULES — Pre-configured auto-reply rules
 * =========================================================
 * These are seeded when an organization first enables the chatbot.
 * Rules use keyword matching and support interactive responses.
 */

export interface ChatbotRuleTemplate {
    name: string;
    keywords: string;
    responseType: 'TEXT' | 'INTERACTIVE_BUTTONS' | 'INTERACTIVE_LIST' | 'REDIRECT_HUMAN';
    response: ChatbotResponse;
    priority: number;
    isDefault: boolean;
}

export interface ChatbotResponse {
    text: string;
    buttons?: Array<{ id: string; title: string }>;
    sections?: Array<{
        title: string;
        rows: Array<{ id: string; title: string; description?: string }>;
    }>;
    listButtonText?: string;
    footer?: string;
}

// ─── Default Rules ───────────────────────────────────────────

export const DEFAULT_CHATBOT_RULES: ChatbotRuleTemplate[] = [
    {
        name: 'Menu principal',
        keywords: 'bonjour,salut,hello,hi,menu,aide,help',
        responseType: 'INTERACTIVE_LIST',
        response: {
            text: '👋 Bienvenue ! Comment puis-je vous aider ?',
            footer: 'Sélectionnez une option ci-dessous',
            listButtonText: '📋 Voir les options',
            sections: [
                {
                    title: 'Informations',
                    rows: [
                        { id: 'info_horaires', title: '🕐 Horaires', description: 'Horaires d\'ouverture' },
                        { id: 'info_lieu', title: '📍 Lieu', description: 'Adresse et accès' },
                        { id: 'info_documents', title: '📄 Documents', description: 'Documents à fournir' },
                    ],
                },
                {
                    title: 'Actions',
                    rows: [
                        { id: 'action_annuler', title: '❌ Annuler', description: 'Annuler ou reporter' },
                        { id: 'action_contact', title: '👤 Conseiller', description: 'Parler à un humain' },
                    ],
                },
            ],
        },
        priority: 10,
        isDefault: true,
    },
    {
        name: 'Horaires',
        keywords: 'horaires,heures,ouverture,fermeture,quand,heure,ouvrir',
        responseType: 'TEXT',
        response: {
            text: '🕐 *Nos horaires d\'ouverture :*\n\n📅 Lundi - Vendredi : 9h00 - 17h30\n📅 Samedi : 9h00 - 12h00\n🔴 Dimanche : Fermé\n\n_Vous pouvez modifier ces horaires dans les paramètres du chatbot._',
        },
        priority: 5,
        isDefault: true,
    },
    {
        name: 'Lieu & Accès',
        keywords: 'lieu,adresse,où,ou,localisation,plan,accès,acces,venir,gps,itinéraire,itineraire',
        responseType: 'INTERACTIVE_BUTTONS',
        response: {
            text: '📍 *Notre adresse :*\n\nVotre adresse sera configurée dans les paramètres.\n\n🚇 Métro : ...\n🚌 Bus : ...\n🅿️ Parking : ...',
            buttons: [
                { id: 'btn_maps', title: '🗺️ Voir sur Maps' },
                { id: 'btn_menu', title: '📋 Menu principal' },
            ],
        },
        priority: 5,
        isDefault: true,
    },
    {
        name: 'Documents requis',
        keywords: 'document,documents,papier,papiers,pièce,piece,justificatif,fournir,apporter,dossier',
        responseType: 'TEXT',
        response: {
            text: '📄 *Documents à fournir :*\n\n✅ Pièce d\'identité (CNI ou passeport)\n✅ Justificatif de domicile (< 3 mois)\n✅ CV à jour\n✅ Photo d\'identité\n✅ Attestation de sécurité sociale\n\n📧 Envoyez vos documents par email ou apportez-les le jour de votre inscription.',
        },
        priority: 5,
        isDefault: true,
    },
    {
        name: 'Annulation / Report',
        keywords: 'annuler,annulation,reporter,report,absent,absence,empêché,empeche,impossible,décaler,decaler',
        responseType: 'INTERACTIVE_BUTTONS',
        response: {
            text: '❌ *Annulation ou report*\n\nVous souhaitez annuler ou reporter votre formation ?\n\n⚠️ Toute annulation doit être signalée au minimum 48h à l\'avance.',
            buttons: [
                { id: 'btn_annuler_confirm', title: '❌ Confirmer annulation' },
                { id: 'btn_reporter', title: '📅 Reporter' },
                { id: 'btn_conseiller', title: '👤 Parler à qqn' },
            ],
        },
        priority: 5,
        isDefault: true,
    },
    {
        name: 'Contact humain',
        keywords: 'conseiller,humain,personne,agent,responsable,parler,appeler,téléphone,telephone,contact,quelqu\'un',
        responseType: 'REDIRECT_HUMAN',
        response: {
            text: '👤 *Transfert vers un conseiller*\n\nVotre conversation est transférée à un conseiller qui vous répondra dès que possible.\n\n⏱️ Temps de réponse moyen : 15 minutes pendant les heures d\'ouverture.',
        },
        priority: 20,
        isDefault: true,
    },
    {
        name: 'Remerciements',
        keywords: 'merci,thanks,super,parfait,génial,genial,top,excellent',
        responseType: 'TEXT',
        response: {
            text: '😊 Avec plaisir ! N\'hésitez pas si vous avez d\'autres questions.\n\nTapez *aide* pour revoir le menu principal.',
        },
        priority: 3,
        isDefault: true,
    },
    {
        name: 'Non compris (fallback)',
        keywords: '__FALLBACK__',
        responseType: 'INTERACTIVE_BUTTONS',
        response: {
            text: '🤔 Je n\'ai pas compris votre message.\n\nVoici ce que je peux faire pour vous :',
            buttons: [
                { id: 'btn_menu', title: '📋 Voir le menu' },
                { id: 'btn_conseiller', title: '👤 Parler à qqn' },
            ],
        },
        priority: -1,
        isDefault: true,
    },
];

// ─── Interactive Reply Mappings ──────────────────────────────
// When a user clicks a button or list item, map the reply ID to an action

export const INTERACTIVE_REPLY_MAPPINGS: Record<string, string> = {
    // List rows → keyword triggers
    'info_horaires': 'horaires',
    'info_lieu': 'lieu',
    'info_documents': 'documents',
    'action_annuler': 'annuler',
    'action_contact': 'conseiller',
    // Buttons → keyword triggers
    'btn_menu': 'menu',
    'btn_maps': 'lieu',
    'btn_conseiller': 'conseiller',
    'btn_annuler_confirm': 'annuler',
    'btn_reporter': 'annuler',
    // NOTE: Reply IDs prefixed with "dossier_" are handled by
    // interactive-actions.ts and bypass keyword matching entirely.
    // Pattern: dossier_{action}_{dossierId}_{extra?}
    // Actions: confirm, reschedule, slot, doc, survey
};
