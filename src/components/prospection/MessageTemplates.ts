export const MESSAGE_TEMPLATES = {
    RDV_CONFIRMATION: "Bonjour {name}, je vous confirme votre rendez-vous téléphonique avec Polyx pour le {date}. Cordialement.",
    NO_ANSWER: "Bonjour {name}, j'ai tenté de vous joindre concernant votre demande de formation. Quand êtes-vous disponible ? Cordialement, Polyx.",
    INFO_SOUHAITEE: "Bonjour {name}, suite à votre demande, je reste à votre disposition pour échanger sur vore projet de formation. Cordialement.",
};

export function getTemplate(key: keyof typeof MESSAGE_TEMPLATES, params: { name: string; date?: string }) {
    let text = MESSAGE_TEMPLATES[key];
    text = text.replace('{name}', params.name);
    if (params.date) text = text.replace('{date}', params.date);
    return text;
}
