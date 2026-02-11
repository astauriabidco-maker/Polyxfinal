/**
 * NOTIFICATION SERVICE - Simulation d'envoi d'emails
 * ==================================================
 * Ce service simule l'envoi d'emails transactionnels.
 * En production, il serait connecté à Resend, SendGrid ou Mailjet.
 */

export interface EmailOptions {
    to: string;
    subject: string;
    template: 'PARTNER_ONBOARDING' | 'PARTNER_ACTIVATED';
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

    console.log('\n--- [EMAIL SERVICE DYNAMIQUE] ---');
    console.log(`TO: ${options.to}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${body}`);
    console.log('--- [FIN EMAIL] ---\n');

    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, messageId: Math.random().toString(36).substring(7) };
}
