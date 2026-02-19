/**
 * MESSAGING SETTINGS PAGE — Configuration WhatsApp / SMS
 * ========================================================
 * Page serveur (admin only) qui charge la config et rend le composant client.
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MessagingConfigPanel from '@/components/settings/MessagingConfigPanel';

export default async function MessagingSettingsPage() {
    const session = await auth();
    if (!session?.user?.organizationId) {
        redirect('/login');
    }

    // Admin only
    if (session.user.role?.code !== 'ADMIN') {
        redirect('/dashboard');
    }

    const organizationId = session.user.organizationId;

    // Load existing config with templates
    const config = await prisma.messagingConfig.findUnique({
        where: { organizationId },
        include: {
            templates: {
                orderBy: { internalKey: 'asc' },
            },
        },
    });

    // Serialize & mask tokens
    const serializedConfig = config
        ? {
            id: config.id,
            provider: config.provider,
            isActive: config.isActive,
            metaPhoneNumberId: config.metaPhoneNumberId,
            metaBusinessId: config.metaBusinessId,
            metaAccessToken: config.metaAccessToken
                ? '••••••••' + config.metaAccessToken.slice(-4)
                : null,
            twilioAccountSid: config.twilioAccountSid,
            twilioAuthToken: config.twilioAuthToken
                ? '••••••••' + config.twilioAuthToken.slice(-4)
                : null,
            twilioPhoneNumber: config.twilioPhoneNumber,
            defaultCountryCode: config.defaultCountryCode,
            templates: config.templates.map((t: any) => ({
                id: t.id,
                internalKey: t.internalKey,
                providerTemplateName: t.providerTemplateName,
                language: t.language,
                fallbackText: t.fallbackText,
                isActive: t.isActive,
            })),
        }
        : null;

    return (
        <DashboardLayout>
            <div className="p-6 max-w-4xl mx-auto">
                <MessagingConfigPanel initialConfig={serializedConfig} />
            </div>
        </DashboardLayout>
    );
}
