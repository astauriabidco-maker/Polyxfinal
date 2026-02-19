'use server';

import { z } from 'zod';
import { generateObject } from 'ai';
import { getAIModel } from '@/lib/ai/provider';

const ProgramContent = z.object({
    objectifs: z.array(z.string()),
    prerequis: z.string(),
    publicCible: z.string(),
    moyensPedago: z.string(),
    modalitesEval: z.string(),
    contenuText: z.string()
});

export async function generateProgramContent(title: string, duration?: string) {
    const systemPrompt = `Tu es une IA experte en ingénierie pédagogique et conformité Qualiopi.
    Génère un programme de formation structuré avec EXACTEMENT ces champs :
    - objectifs: Tableau de strings. Objectifs opérationnels précis commençant par un verbe d'action (ex: "Maîtriser...", "Appliquer..."). Minimum 3 objectifs.
    - prerequis: String. Prérequis nécessaires (ou "Aucun prérequis").
    - publicCible: String. Public visé par la formation.
    - moyensPedago: String. Méthodes et moyens pédagogiques (ex: "Alternance théorie/pratique, support de cours...").
    - modalitesEval: String. Modalités d'évaluation (ex: "QCM, Mise en situation...").
    - contenuText: String. Le programme détaillé jour par jour (ou module par module) rédigé proprement en markdown.

    Le contenu doit être en Français, professionnel, et adapté au titre fourni.`;

    const userPrompt = `Titre de la formation : "${title}"
    Durée estimée : "${duration || "Durée standard adaptée au sujet"}"`;

    try {
        const model = getAIModel();

        const result = await generateObject({
            model: model,
            schema: ProgramContent,
            prompt: `${systemPrompt}\n\n${userPrompt}`,
        });

        return { data: result.object };

    } catch (error: any) {
        console.error("AI Generation Error:", error);
        return { error: `Erreur IA: ${error.message}` };
    }
}
