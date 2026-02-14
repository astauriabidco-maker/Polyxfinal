/**
 * NOTIFICATION SERVICE - Simulation d'envoi d'emails
 * ==================================================
 * Ce service simule l'envoi d'emails transactionnels.
 * En production, il serait connecté à Resend, SendGrid ou Mailjet.
 */

export interface EmailOptions {
    to: string;
    subject: string;
    template: 'PARTNER_ONBOARDING' | 'PARTNER_ACTIVATED' | 'USER_INVITATION' | 'USER_ADDED_TO_ORG';
    data: any;
}

export async function sendTransactionalEmail(options: EmailOptions) {
    const { prisma } = await import('@/lib/prisma');

    // Tentative de récupération des templates dynamiques
    const settings = await prisma.networkSettings.findFirst();

    let subject = options.subject;
    let body = "";

    if (options.template === 'PARTNER_ONBOARDING') {
        const onboardingUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/partners/onboarding/${options.data.partnerId}`;

        subject = settings?.onboardingEmailSubject || options.subject;
        body = settings?.onboardingEmailBody || "Bonjour {{contactName}},\n\nVeuillez signer vos contrats de partenariat ici : {{onboardingUrl}}\n\nDocuments joints : Contrat.pdf, DPA.pdf, CGV.pdf";

        // Remplacement des variables
        body = body
            .replace('{{contactName}}', options.data.contactName)
            .replace('{{companyName}}', options.data.companyName)
            .replace('{{onboardingUrl}}', onboardingUrl);
    }

    if (options.template === 'PARTNER_ACTIVATED') {
        const docsUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/partners/docs`;

        subject = settings?.activationEmailSubject || options.subject;
        body = settings?.activationEmailBody || "Félicitations {{contactName}},\n\nVos contrats ont été contre-signés par Polyx ERP.\n\nVOTRE CLÉ API : {{apiKey}}\n\nDOCUMENTATION TECHNIQUE : {{docsUrl}}";

        body = body
            .replace('{{contactName}}', options.data.contactName)
            .replace('{{apiKey}}', options.data.apiKey)
            .replace('{{docsUrl}}', docsUrl);
    }

    if (options.template === 'USER_INVITATION') {
        const loginUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login`;

        subject = options.subject || `Bienvenue sur Polyx ERP — Vos identifiants de connexion`;
        body = `Bonjour ${options.data.prenom} ${options.data.nom},\n\n` +
            `Vous avez été invité(e) à rejoindre l'organisation "${options.data.organizationName}" sur Polyx ERP.\n\n` +
            `Votre rôle : ${options.data.roleName}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `  VOS IDENTIFIANTS\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `  Email : ${options.data.email}\n` +
            `  Mot de passe : ${options.data.password}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🔗 Connectez-vous ici : ${loginUrl}\n\n` +
            `⚠️ Nous vous recommandons de changer votre mot de passe après votre première connexion.\n` +
            `   Rendez-vous dans Paramètres > Mot de passe.\n\n` +
            `Cordialement,\nL'équipe Polyx ERP`;
    }

    if (options.template === 'USER_ADDED_TO_ORG') {
        const loginUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login`;

        subject = options.subject || `Polyx ERP — Vous avez été ajouté(e) à une nouvelle organisation`;
        body = `Bonjour ${options.data.prenom} ${options.data.nom},\n\n` +
            `Vous avez été ajouté(e) à l'organisation "${options.data.organizationName}" sur Polyx ERP.\n\n` +
            `Votre rôle : ${options.data.roleName}\n\n` +
            `Connectez-vous avec vos identifiants habituels : ${loginUrl}\n\n` +
            `Cordialement,\nL'équipe Polyx ERP`;
    }

    console.log('\n--- [EMAIL SERVICE DYNAMIQUE] ---');
    console.log(`TO: ${options.to}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${body}`);
    console.log('--- [FIN EMAIL] ---\n');

    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, messageId: Math.random().toString(36).substring(7) };
}
