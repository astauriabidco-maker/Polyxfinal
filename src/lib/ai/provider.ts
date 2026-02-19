import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createMistral } from '@ai-sdk/mistral';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function getAIModel() {
    // 1. Default from Env
    let provider = process.env.AI_PROVIDER?.toLowerCase() || 'openai';
    let apiKey = process.env.OPENAI_API_KEY; // Default for default provider
    let modelId = process.env.AI_MODEL;

    // 2. Check DB Override
    const session = await auth();
    if (session?.user?.organizationId) {
        const settings = await prisma.aISettings.findUnique({
            where: { organizationId: session.user.organizationId }
        });

        if (settings && settings.isActive) {
            provider = settings.provider.toLowerCase();
            modelId = settings.model || undefined;
            if (settings.apiKey) {
                apiKey = settings.apiKey;
            } else {
                // If no key in DB, try env var for THAT provider
                if (provider === 'anthropic') apiKey = process.env.ANTHROPIC_API_KEY;
                else if (provider === 'mistral') apiKey = process.env.MISTRAL_API_KEY;
                else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY;
            }
        }
    }

    // 3. Create Instance
    switch (provider) {
        case 'anthropic':
            if (!apiKey) throw new Error("Clé API Anthropic manquante (DB ou ENV)");
            const anthropic = createAnthropic({ apiKey });
            return anthropic(modelId || 'claude-3-haiku-20240307');

        case 'mistral':
            if (!apiKey) throw new Error("Clé API Mistral manquante (DB ou ENV)");
            const mistral = createMistral({ apiKey });
            return mistral(modelId || 'mistral-large-latest');

        case 'openai':
        default:
            if (!apiKey) throw new Error("Clé API OpenAI manquante (DB ou ENV)");
            const openai = createOpenAI({ apiKey });
            // Default model fallback if not set
            return openai(modelId || 'gpt-4o');
    }
}
