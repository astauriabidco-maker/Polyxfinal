
import { z } from 'zod';

export const StagiaireSchema = z.object({
    nom: z.string().min(2, "Le nom est requis"),
    prenom: z.string().min(2, "Le prénom est requis"),
    email: z.string().email("Email invalide"),
    telephone: z.string().optional().or(z.literal('')),
});

export type StagiaireInput = z.infer<typeof StagiaireSchema>;
