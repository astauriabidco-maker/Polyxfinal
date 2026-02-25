/**
 * SCRIPT ENGINE — Moteur d'arbre décisionnel de qualification
 * =============================================================
 * Gère l'exécution des scripts de qualification avec :
 *   - Branchement conditionnel (Oui/Non, Choix multiple)
 *   - Scoring progressif des réponses
 *   - Recommandation d'action automatique
 *   - Historique complet des réponses
 */

import { prisma } from '@/lib/prisma';
import { ScriptNodeType, ScriptCategory } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────

export interface ScriptNodeOption {
    value: string;
    label: string;
    nextNodeId: string | null;
    scoreImpact: number;
}

export interface ActionTrigger {
    type: 'SUGGEST_RDV' | 'FLAG_COLD' | 'SUGGEST_CALLBACK' | 'DISQUALIFY' | 'HIGHLIGHT';
    condition: string; // "yes", "no", or option value
    message?: string;
}

export interface NodeWithMeta {
    id: string;
    question: string;
    helpText: string | null;
    type: ScriptNodeType;
    ordre: number;
    isRequired: boolean;
    scoreWeight: number;
    options: ScriptNodeOption[] | null;
    yesNextNodeId: string | null;
    noNextNodeId: string | null;
    defaultNextId: string | null;
    actionTrigger: ActionTrigger | null;
}

export interface ExecutionState {
    executionId: string;
    scriptName: string;
    currentNode: NodeWithMeta | null;
    answeredCount: number;
    totalScore: number;
    maxPossibleScore: number;
    isComplete: boolean;
    recommendation: string | null;
    recommendedAction: string | null;
    triggeredActions: ActionTrigger[];
    history: { nodeId: string; question: string; answer: string; scoreEarned: number }[];
}

// ─── Engine Functions ─────────────────────────────────────────

/**
 * Récupérer le script par défaut de l'organisation (ou le premier actif)
 */
export async function getDefaultScript(organizationId: string) {
    // Chercher le script par défaut
    let script = await prisma.qualificationScript.findFirst({
        where: { organizationId, isDefault: true, isActive: true },
        include: {
            nodes: { orderBy: { ordre: 'asc' } },
        },
    });

    // Sinon, prendre le premier script actif
    if (!script) {
        script = await prisma.qualificationScript.findFirst({
            where: { organizationId, isActive: true },
            include: {
                nodes: { orderBy: { ordre: 'asc' } },
            },
        });
    }

    return script;
}

/**
 * Démarrer une exécution de script pour un lead
 */
export async function startExecution(
    scriptId: string,
    leadId: string,
    userId: string,
): Promise<ExecutionState> {
    const script = await prisma.qualificationScript.findUnique({
        where: { id: scriptId },
        include: { nodes: { orderBy: { ordre: 'asc' } } },
    });

    if (!script || script.nodes.length === 0) {
        return {
            executionId: '',
            scriptName: script?.name || 'Aucun script',
            currentNode: null,
            answeredCount: 0,
            totalScore: 0,
            maxPossibleScore: 0,
            isComplete: true,
            recommendation: 'Aucun script configuré',
            recommendedAction: null,
            triggeredActions: [],
            history: [],
        };
    }

    // Calculer le max possible
    const maxScore = script.nodes.reduce((sum, n) => sum + Math.max(n.scoreWeight, 0), 0);

    // Créer l'exécution
    const execution = await prisma.scriptExecution.create({
        data: {
            scriptId,
            leadId,
            userId,
            maxPossibleScore: maxScore,
        },
    });

    // Trouver le premier nœud (rootNodeId ou premier par ordre)
    const firstNodeId = script.rootNodeId || script.nodes[0]?.id;
    const firstNode = script.nodes.find(n => n.id === firstNodeId) || script.nodes[0];

    return {
        executionId: execution.id,
        scriptName: script.name,
        currentNode: firstNode ? formatNode(firstNode) : null,
        answeredCount: 0,
        totalScore: 0,
        maxPossibleScore: maxScore,
        isComplete: false,
        recommendation: null,
        recommendedAction: null,
        triggeredActions: [],
        history: [],
    };
}

/**
 * Enregistrer une réponse et avancer dans l'arbre
 */
export async function answerNode(
    executionId: string,
    nodeId: string,
    answer: string,
): Promise<ExecutionState> {
    // Charger l'exécution avec le script et les nœuds
    const execution = await prisma.scriptExecution.findUnique({
        where: { id: executionId },
        include: {
            script: {
                include: { nodes: { orderBy: { ordre: 'asc' } } },
            },
            responses: { include: { node: true } },
        },
    });

    if (!execution) {
        throw new Error('Execution not found');
    }

    const node = execution.script.nodes.find(n => n.id === nodeId);
    if (!node) {
        throw new Error('Node not found in script');
    }

    // Calculer le score gagné pour cette réponse
    const scoreEarned = calculateNodeScore(node, answer);

    // Enregistrer la réponse
    await prisma.scriptResponse.create({
        data: {
            executionId,
            nodeId,
            answer,
            scoreEarned,
        },
    });

    // Trouver le prochain nœud
    const nextNodeId = resolveNextNode(node, answer);
    const nextNode = nextNodeId
        ? execution.script.nodes.find(n => n.id === nextNodeId)
        : null;

    // Mettre à jour le score total
    const newTotal = execution.totalScore + scoreEarned;
    const answeredCount = execution.responses.length + 1;

    // Vérifier les déclencheurs d'action
    const triggeredActions: ActionTrigger[] = [];
    if (node.actionTrigger) {
        const trigger = node.actionTrigger as unknown as ActionTrigger;
        if (shouldTriggerAction(trigger, answer)) {
            triggeredActions.push(trigger);
        }
    }

    // Historique enrichi
    const history = [
        ...execution.responses.map(r => ({
            nodeId: r.nodeId,
            question: r.node.question,
            answer: r.answer,
            scoreEarned: r.scoreEarned,
        })),
        { nodeId, question: node.question, answer, scoreEarned },
    ];

    // Si pas de prochain nœud → terminé
    const isComplete = !nextNode;

    let recommendation: string | null = null;
    let recommendedAction: string | null = null;

    if (isComplete) {
        // Calculer la recommandation finale
        const result = generateRecommendation(newTotal, execution.maxPossibleScore, triggeredActions, history);
        recommendation = result.recommendation;
        recommendedAction = result.action;

        // Finaliser l'exécution
        await prisma.scriptExecution.update({
            where: { id: executionId },
            data: {
                totalScore: newTotal,
                completedAt: new Date(),
                scorePercentage: execution.maxPossibleScore > 0
                    ? Math.round((newTotal / execution.maxPossibleScore) * 100)
                    : 0,
                recommendation,
                recommendedAction,
            },
        });
    } else {
        // Mettre à jour le score courant
        await prisma.scriptExecution.update({
            where: { id: executionId },
            data: { totalScore: newTotal },
        });
    }

    return {
        executionId,
        scriptName: execution.script.name,
        currentNode: nextNode ? formatNode(nextNode) : null,
        answeredCount,
        totalScore: newTotal,
        maxPossibleScore: execution.maxPossibleScore,
        isComplete,
        recommendation,
        recommendedAction,
        triggeredActions,
        history,
    };
}

// ─── Helpers ──────────────────────────────────────────────────

function formatNode(node: any): NodeWithMeta {
    return {
        id: node.id,
        question: node.question,
        helpText: node.helpText,
        type: node.type,
        ordre: node.ordre,
        isRequired: node.isRequired,
        scoreWeight: node.scoreWeight,
        options: node.options as ScriptNodeOption[] | null,
        yesNextNodeId: node.yesNextNodeId,
        noNextNodeId: node.noNextNodeId,
        defaultNextId: node.defaultNextId,
        actionTrigger: node.actionTrigger as ActionTrigger | null,
    };
}

function calculateNodeScore(node: any, answer: string): number {
    switch (node.type) {
        case 'YES_NO':
            return answer.toLowerCase() === 'oui' ? node.scoreWeight : 0;

        case 'CHOICE': {
            const options = (node.options || []) as ScriptNodeOption[];
            const selected = options.find(o => o.value === answer);
            return selected?.scoreImpact ?? 0;
        }

        case 'RATING': {
            const rating = parseInt(answer) || 0;
            // Score proportionnel au rating (1-5 → 0-100% du poids)
            return Math.round((rating / 5) * node.scoreWeight);
        }

        case 'OPEN_TEXT':
            // Score si réponse non vide
            return answer.trim().length > 0 ? node.scoreWeight : 0;

        case 'INFO':
            return 0;

        default:
            return 0;
    }
}

function resolveNextNode(node: any, answer: string): string | null {
    switch (node.type) {
        case 'YES_NO':
            return answer.toLowerCase() === 'oui'
                ? node.yesNextNodeId
                : node.noNextNodeId;

        case 'CHOICE': {
            const options = (node.options || []) as ScriptNodeOption[];
            const selected = options.find(o => o.value === answer);
            return selected?.nextNodeId || node.defaultNextId || null;
        }

        default:
            return node.defaultNextId || null;
    }
}

function shouldTriggerAction(trigger: ActionTrigger, answer: string): boolean {
    if (trigger.condition === 'any') return true;
    if (trigger.condition === 'yes' && answer.toLowerCase() === 'oui') return true;
    if (trigger.condition === 'no' && answer.toLowerCase() === 'non') return true;
    if (trigger.condition === answer) return true;
    return false;
}

function generateRecommendation(
    totalScore: number,
    maxScore: number,
    triggeredActions: ActionTrigger[],
    history: { answer: string; scoreEarned: number }[],
): { recommendation: string; action: string } {
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    // Vérifier les actions déclenchées prioritaires
    const hasRdvSuggestion = triggeredActions.some(a => a.type === 'SUGGEST_RDV');
    const hasColdFlag = triggeredActions.some(a => a.type === 'FLAG_COLD');
    const hasDisqualify = triggeredActions.some(a => a.type === 'DISQUALIFY');

    if (hasDisqualify) {
        return {
            recommendation: '🔴 Lead non qualifié — critères rédhibitoires détectés. Fermer le dossier.',
            action: 'DISQUALIFY',
        };
    }

    if (hasRdvSuggestion && percentage >= 50) {
        return {
            recommendation: `🟢 Lead très qualifié (${Math.round(percentage)}%) ! Le prospect a exprimé un intérêt fort. Proposez un rendez-vous maintenant.`,
            action: 'BOOK_RDV',
        };
    }

    if (percentage >= 75) {
        return {
            recommendation: `🟢 Excellent score (${Math.round(percentage)}%) ! Lead chaud, hautement qualifié. Proposez un RDV immédiatement.`,
            action: 'BOOK_RDV',
        };
    }

    if (percentage >= 50) {
        return {
            recommendation: `🟡 Score correct (${Math.round(percentage)}%). Le prospect montre de l'intérêt. Planifiez un rappel pour consolider.`,
            action: 'FOLLOW_UP',
        };
    }

    if (hasColdFlag || percentage < 30) {
        return {
            recommendation: `🔴 Score faible (${Math.round(percentage)}%). Prospect froid ou non qualifié. Envisagez une relance tardive ou la fermeture.`,
            action: 'DISQUALIFY',
        };
    }

    return {
        recommendation: `🟠 Score moyen (${Math.round(percentage)}%). Besoin de maturation — programmez un rappel et envoyez des informations complémentaires.`,
        action: 'FOLLOW_UP',
    };
}

// ─── SEED — Templates par défaut ─────────────────────────────

/**
 * Créer les scripts par défaut pour une organisation
 */
export async function seedDefaultScripts(organizationId: string, category: ScriptCategory = 'OF_STANDARD') {
    // Vérifier si des scripts existent déjà
    const existing = await prisma.qualificationScript.count({
        where: { organizationId },
    });
    if (existing > 0) return;

    if (category === 'CFA') {
        await seedCFAScript(organizationId);
    } else {
        await seedOFScript(organizationId);
    }
}

async function seedOFScript(organizationId: string) {
    const script = await prisma.qualificationScript.create({
        data: {
            organizationId,
            name: 'Script OF — Qualification Standard',
            description: 'Script de qualification pour organismes de formation (parcours finançable CPF/OPCO)',
            category: 'OF_STANDARD',
            isActive: true,
            isDefault: true,
        },
    });

    // Créer les nœuds de l'arbre
    const nodes = await Promise.all([
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 1,
                question: '👋 Bonjour ! J\'appelle de la part de [Organisme]. Vous avez montré de l\'intérêt pour une formation. Avez-vous quelques minutes pour en discuter ?',
                helpText: 'Introduction chaleureuse. Si le prospect est pressé, proposer un rappel.',
                type: 'YES_NO', scoreWeight: 5,
                actionTrigger: { type: 'FLAG_COLD', condition: 'no', message: 'Prospect pas disponible' },
            },
        }),
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 2,
                question: 'Quelle formation vous intéresse en particulier ?',
                helpText: 'Identifier précisément le besoin. Reformuler pour valider la compréhension.',
                type: 'OPEN_TEXT', scoreWeight: 5,
            },
        }),
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 3,
                question: 'Avez-vous déjà une idée du financement que vous souhaitez utiliser ?',
                helpText: 'CPF, OPCO, Pôle Emploi, Autofinancement... Cela détermine le parcours administratif.',
                type: 'CHOICE', scoreWeight: 10,
                options: [
                    { value: 'CPF', label: '💳 CPF (Mon Compte Formation)', nextNodeId: null, scoreImpact: 10 },
                    { value: 'OPCO', label: '🏢 OPCO (employeur)', nextNodeId: null, scoreImpact: 8 },
                    { value: 'POLE_EMPLOI', label: '🔍 Pôle Emploi / France Travail', nextNodeId: null, scoreImpact: 7 },
                    { value: 'AUTO', label: '💰 Autofinancement', nextNodeId: null, scoreImpact: 5 },
                    { value: 'NE_SAIT_PAS', label: '❓ Je ne sais pas encore', nextNodeId: null, scoreImpact: 3 },
                ],
            },
        }),
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 4,
                question: 'Êtes-vous actuellement en poste ou en recherche d\'emploi ?',
                helpText: 'Impacte le type de financement et la disponibilité pour la formation.',
                type: 'CHOICE', scoreWeight: 5,
                options: [
                    { value: 'EN_POSTE', label: '💼 En poste (salarié)', nextNodeId: null, scoreImpact: 5 },
                    { value: 'RECHERCHE', label: '🔍 En recherche d\'emploi', nextNodeId: null, scoreImpact: 4 },
                    { value: 'INDEPENDANT', label: '🧑‍💻 Indépendant / Freelance', nextNodeId: null, scoreImpact: 5 },
                    { value: 'ETUDIANT', label: '🎓 Étudiant', nextNodeId: null, scoreImpact: 3 },
                ],
            },
        }),
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 5,
                question: 'Avez-vous un calendrier en tête pour démarrer la formation ?',
                helpText: 'Urgence = lead chaud. "Dès que possible" est un excellent signal.',
                type: 'CHOICE', scoreWeight: 10,
                options: [
                    { value: 'ASAP', label: '🚀 Dès que possible', nextNodeId: null, scoreImpact: 10 },
                    { value: '1_MOIS', label: '📅 Dans le mois', nextNodeId: null, scoreImpact: 8 },
                    { value: '3_MOIS', label: '📆 Dans les 3 prochains mois', nextNodeId: null, scoreImpact: 5 },
                    { value: 'PLUS_TARD', label: '⏳ Plus tard / Pas décidé', nextNodeId: null, scoreImpact: 2 },
                ],
                actionTrigger: { type: 'SUGGEST_RDV', condition: 'ASAP', message: 'Prospect urgent — proposer RDV immédiat' },
            },
        }),
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 6,
                question: 'Souhaitez-vous qu\'on fixe un rendez-vous pour faire le point ensemble et vous accompagner dans les démarches ?',
                helpText: 'C\'est LA question clé. Être direct et enthousiaste.',
                type: 'YES_NO', scoreWeight: 15,
                actionTrigger: { type: 'SUGGEST_RDV', condition: 'yes', message: 'Le prospect accepte un RDV !' },
            },
        }),
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 7,
                question: 'De 1 à 5, comment évaluez-vous votre motivation pour cette formation ?',
                helpText: 'Score de motivation. 4-5 = lead chaud, 1-2 = lead froid.',
                type: 'RATING', scoreWeight: 10,
            },
        }),
    ]);

    // Wiring de l'arbre (branchement)
    // Node 1 (dispo?) → Oui: Node 2, Non: fin (cold)
    // Node 2 (formation?) → Node 3
    // Node 3 (financement?) → Node 4
    // Node 4 (situation?) → Node 5
    // Node 5 (calendrier?) → Node 6
    // Node 6 (rdv?) → Oui: Node 7, Non: Node 7
    // Node 7 (motivation) → fin

    await prisma.scriptNode.update({ where: { id: nodes[0].id }, data: { yesNextNodeId: nodes[1].id, noNextNodeId: null } });
    await prisma.scriptNode.update({ where: { id: nodes[1].id }, data: { defaultNextId: nodes[2].id } });
    // For CHOICE nodes, set all options' nextNodeId to the next node
    const n3Options = (nodes[2].options as any[]).map((o: any) => ({ ...o, nextNodeId: nodes[3].id }));
    await prisma.scriptNode.update({ where: { id: nodes[2].id }, data: { options: n3Options, defaultNextId: nodes[3].id } });
    const n4Options = (nodes[3].options as any[]).map((o: any) => ({ ...o, nextNodeId: nodes[4].id }));
    await prisma.scriptNode.update({ where: { id: nodes[3].id }, data: { options: n4Options, defaultNextId: nodes[4].id } });
    const n5Options = (nodes[4].options as any[]).map((o: any) => ({ ...o, nextNodeId: nodes[5].id }));
    await prisma.scriptNode.update({ where: { id: nodes[4].id }, data: { options: n5Options, defaultNextId: nodes[5].id } });
    await prisma.scriptNode.update({ where: { id: nodes[5].id }, data: { yesNextNodeId: nodes[6].id, noNextNodeId: nodes[6].id } });
    // Node 7 (final) has no next

    // Set root node
    await prisma.qualificationScript.update({ where: { id: script.id }, data: { rootNodeId: nodes[0].id } });
}

async function seedCFAScript(organizationId: string) {
    const script = await prisma.qualificationScript.create({
        data: {
            organizationId,
            name: 'Script CFA — Qualification Apprentissage',
            description: 'Script de qualification pour centres de formation d\'apprentis (contrat d\'apprentissage)',
            category: 'CFA',
            isActive: true,
            isDefault: true,
        },
    });

    const nodes = await Promise.all([
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 1,
                question: '👋 Bonjour ! Vous avez montré de l\'intérêt pour une formation en apprentissage. Êtes-vous disponible pour en discuter ?',
                helpText: 'Introduction spécifique apprentissage.',
                type: 'YES_NO', scoreWeight: 5,
                actionTrigger: { type: 'FLAG_COLD', condition: 'no' },
            },
        }),
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 2,
                question: 'Quel diplôme ou certification vous intéresse ?',
                helpText: 'BTS, Licence Pro, Bachelor, Master... Identifier le niveau visé.',
                type: 'OPEN_TEXT', scoreWeight: 5,
            },
        }),
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 3,
                question: 'Avez-vous déjà trouvé une entreprise d\'accueil pour votre alternance ?',
                helpText: 'C\'est le critère clé pour l\'apprentissage. Avec employeur = inscription quasi garantie.',
                type: 'CHOICE', scoreWeight: 15,
                options: [
                    { value: 'OUI_SIGNE', label: '✅ Oui, contrat signé', nextNodeId: null, scoreImpact: 15 },
                    { value: 'OUI_EN_COURS', label: '🤝 En discussion avec une entreprise', nextNodeId: null, scoreImpact: 10 },
                    { value: 'EN_RECHERCHE', label: '🔍 Je cherche encore', nextNodeId: null, scoreImpact: 5 },
                    { value: 'BESOIN_AIDE', label: '🆘 J\'ai besoin d\'aide pour trouver', nextNodeId: null, scoreImpact: 3 },
                ],
                actionTrigger: { type: 'SUGGEST_RDV', condition: 'OUI_SIGNE', message: 'Employeur trouvé — planifier inscription !' },
            },
        }),
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 4,
                question: 'Quel est votre âge ?',
                helpText: 'L\'apprentissage est accessible jusqu\'à 29 ans révolus (sauf exceptions : RQTH, sportif HN, création d\'entreprise).',
                type: 'CHOICE', scoreWeight: 10,
                options: [
                    { value: 'MOINS_18', label: '🎒 Moins de 18 ans', nextNodeId: null, scoreImpact: 10 },
                    { value: '18_25', label: '🧑 18-25 ans', nextNodeId: null, scoreImpact: 10 },
                    { value: '26_29', label: '🧑‍💼 26-29 ans', nextNodeId: null, scoreImpact: 8 },
                    { value: 'PLUS_30', label: '👤 30 ans ou plus', nextNodeId: null, scoreImpact: 3 },
                ],
            },
        }),
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 5,
                question: 'Pour quand souhaitez-vous démarrer votre alternance ?',
                helpText: 'Les rentrées sont souvent en septembre ou janvier.',
                type: 'CHOICE', scoreWeight: 10,
                options: [
                    { value: 'PROCHAINE_RENTREE', label: '📅 Prochaine rentrée', nextNodeId: null, scoreImpact: 10 },
                    { value: 'CETTE_ANNEE', label: '📆 Dans l\'année', nextNodeId: null, scoreImpact: 7 },
                    { value: 'RENSEIGNEMENT', label: '🔎 Simple renseignement', nextNodeId: null, scoreImpact: 3 },
                ],
                actionTrigger: { type: 'SUGGEST_RDV', condition: 'PROCHAINE_RENTREE' },
            },
        }),
        prisma.scriptNode.create({
            data: {
                scriptId: script.id, ordre: 6,
                question: 'Souhaitez-vous qu\'on prenne rendez-vous pour vous accompagner dans vos démarches d\'inscription et de recherche d\'entreprise ?',
                helpText: 'Proposition directe de RDV. Mentionner l\'accompagnement dans la recherche d\'employeur si besoin.',
                type: 'YES_NO', scoreWeight: 15,
                actionTrigger: { type: 'SUGGEST_RDV', condition: 'yes' },
            },
        }),
    ]);

    // Wiring
    await prisma.scriptNode.update({ where: { id: nodes[0].id }, data: { yesNextNodeId: nodes[1].id } });
    await prisma.scriptNode.update({ where: { id: nodes[1].id }, data: { defaultNextId: nodes[2].id } });
    const n3Opts = (nodes[2].options as any[]).map((o: any) => ({ ...o, nextNodeId: nodes[3].id }));
    await prisma.scriptNode.update({ where: { id: nodes[2].id }, data: { options: n3Opts, defaultNextId: nodes[3].id } });
    const n4Opts = (nodes[3].options as any[]).map((o: any) => ({ ...o, nextNodeId: nodes[4].id }));
    await prisma.scriptNode.update({ where: { id: nodes[3].id }, data: { options: n4Opts, defaultNextId: nodes[4].id } });
    const n5Opts = (nodes[4].options as any[]).map((o: any) => ({ ...o, nextNodeId: nodes[5].id }));
    await prisma.scriptNode.update({ where: { id: nodes[4].id }, data: { options: n5Opts, defaultNextId: nodes[5].id } });

    await prisma.qualificationScript.update({ where: { id: script.id }, data: { rootNodeId: nodes[0].id } });
}
