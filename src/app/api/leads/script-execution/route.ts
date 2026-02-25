/**
 * API SCRIPT EXECUTION — Endpoint pour le cockpit d'appel
 * =========================================================
 * POST /api/leads/script-execution
 *   - action: "start" → démarre une exécution
 *   - action: "answer" → enregistre une réponse et avance
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDefaultScript, startExecution, answerNode, seedDefaultScripts } from '@/lib/prospection/script-engine';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organizationId || !session?.user?.id) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
        }

        const body = await request.json();
        const { action } = body;

        if (action === 'start') {
            const { leadId } = body;
            if (!leadId) {
                return NextResponse.json({ error: 'leadId requis' }, { status: 400 });
            }

            // Seed les scripts par défaut si aucun n'existe
            await seedDefaultScripts(session.user.organizationId);

            // Récupérer le script par défaut
            const script = await getDefaultScript(session.user.organizationId);
            if (!script) {
                return NextResponse.json({
                    success: true,
                    state: {
                        executionId: '',
                        scriptName: 'Aucun script configuré',
                        currentNode: null,
                        answeredCount: 0,
                        totalScore: 0,
                        maxPossibleScore: 0,
                        isComplete: true,
                        recommendation: 'Aucun script configuré pour cette organisation.',
                        recommendedAction: null,
                        triggeredActions: [],
                        history: [],
                    },
                });
            }

            const state = await startExecution(script.id, leadId, session.user.id);
            return NextResponse.json({ success: true, state });
        }

        if (action === 'answer') {
            const { executionId, nodeId, answer } = body;
            if (!executionId || !nodeId || answer === undefined) {
                return NextResponse.json({ error: 'executionId, nodeId et answer requis' }, { status: 400 });
            }

            const state = await answerNode(executionId, nodeId, answer);
            return NextResponse.json({ success: true, state });
        }

        return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    } catch (error: any) {
        console.error('Erreur script execution:', error?.message, error?.stack);
        return NextResponse.json({ error: 'Erreur serveur', details: error?.message }, { status: 500 });
    }
}
