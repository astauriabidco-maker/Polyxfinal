
import { z } from 'zod';
import { Modalite, PhaseStatus } from '@prisma/client';

export const ProgramModaliteEnum = z.nativeEnum(Modalite);
export const ProgramStatusEnum = z.nativeEnum(PhaseStatus);

export const ProgramContentSchema = z.object({
    day1: z.string().optional(),
    day2: z.string().optional(),
    day3: z.string().optional(),
    day4: z.string().optional(),
    day5: z.string().optional(),
    modules: z.array(z.string()).optional(),
    sections: z.array(z.object({
        title: z.string(),
        content: z.string(),
        duration: z.string().optional()
    })).optional()
}).catchall(z.any()); // Flexible JSON

export const ProgramSchema = z.object({
    // Identification
    reference: z.string().min(3, "La référence doit faire au moins 3 caractères"),
    title: z.string().min(3, "Le titre est obligatoire"),
    isTemplate: z.boolean().default(false),

    // Pédagogie (Qualiopi)
    publicCible: z.string().optional(),
    prerequis: z.string().min(5, "Les prérequis sont obligatoires (Qualiopi)"),
    objectifs: z.array(z.string().min(3, "Objectif trop court"))
        .min(1, "Vous devez définir au moins un objectif pédagogique (Qualiopi)"),

    // Contenu & Modalités
    dureeHeures: z.coerce.number().int().positive("La durée en heures doit être positive"), // coerce handles string inputs from forms
    dureeJours: z.coerce.number().nonnegative().optional().default(0),
    modalite: ProgramModaliteEnum.default(Modalite.PRESENTIEL),
    contenu: ProgramContentSchema.optional(),

    moyensPedago: z.string().optional(),
    modalitesEval: z.string().optional(),

    // Tarification
    tarifInter: z.coerce.number().nonnegative().optional(),
    tarifIntra: z.coerce.number().nonnegative().optional(),

    // Publication
    isPublished: z.boolean().default(false),
    status: ProgramStatusEnum.default(PhaseStatus.BROUILLON),
});

export type ProgramInput = z.infer<typeof ProgramSchema>;
