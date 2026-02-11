/**
 * MOTEUR DE QUALIFICATION FRANCHISE
 * =================================
 * Calcule les scores de pré-qualification basés sur le questionnaire.
 */

export interface QualificationAnswers {
    investmentCapacity: 'LESS_20K' | '20K_50K' | '50K_100K' | 'OVER_100K';
    totalBudget: number;
    hasPedagogicalExp: boolean;
    hasManagementExp: boolean;
    hasEntrepreneurialExp: boolean;
    targetZone: string;
    hasLocal: boolean;
    timing: 'URGENT' | 'MEDIUM' | 'LONG_TERM'; // <3m, 3-6m, >6m
    motivationChoice: string;
}

export interface QualificationScores {
    global: number;
    financial: number;
    experience: number;
    geo: number;
    timing: number;
    motivation: number;
}

export function calculateCandidateScores(answers: Partial<QualificationAnswers>): QualificationScores {
    const scores = {
        financial: 0,
        experience: 0,
        geo: 0,
        timing: 0,
        motivation: 0
    };

    // 1. Score Financier (Apport Personnel)
    switch (answers.investmentCapacity) {
        case 'OVER_100K': scores.financial = 100; break;
        case '50K_100K': scores.financial = 70; break;
        case '20K_50K': scores.financial = 40; break;
        case 'LESS_20K': scores.financial = 10; break;
        default: scores.financial = 0;
    }

    // 2. Score Expérience
    let expScore = 0;
    if (answers.hasPedagogicalExp) expScore += 40;
    if (answers.hasManagementExp) expScore += 30;
    if (answers.hasEntrepreneurialExp) expScore += 30;
    scores.experience = expScore;

    // 3. Score Géo
    if (answers.hasLocal) {
        scores.geo = 100;
    } else if (answers.targetZone) {
        scores.geo = 50;
    }

    // 4. Score Timing
    switch (answers.timing) {
        case 'URGENT': scores.timing = 100; break;
        case 'MEDIUM': scores.timing = 70; break;
        case 'LONG_TERM': scores.timing = 30; break;
        default: scores.timing = 0;
    }

    // 5. Score Motivation (Heuristique simplifiée : longueur de la réponse)
    if (answers.motivationChoice) {
        const length = answers.motivationChoice.length;
        scores.motivation = Math.min(100, Math.floor(length / 2)); // 200 chars = 100%
    }

    // Score Global Pondéré
    // Finance: 30%, Exp: 30%, Géo: 20%, Timing: 10%, Motiv: 10%
    const global = Math.round(
        (scores.financial * 0.3) +
        (scores.experience * 0.3) +
        (scores.geo * 0.2) +
        (scores.timing * 0.1) +
        (scores.motivation * 0.1)
    );

    return {
        global,
        ...scores
    };
}
