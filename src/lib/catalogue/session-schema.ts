
import { z } from 'zod';
import { SessionStatus } from '@prisma/client';

export const SessionStatusEnum = z.nativeEnum(SessionStatus);

export const SessionSchema = z.object({
    programmeId: z.string().min(1, "Programme requis"),
    siteId: z.string().min(1, "Lieu obligatoire"),
    formateurId: z.string().optional().nullable(),
    dateDebut: z.string().min(1, "Date de début requise"),
    dateFin: z.string().min(1, "Date de fin requise"),
    placesMin: z.coerce.number().min(1).default(1),
    placesMax: z.coerce.number().min(1).default(10),
    status: SessionStatusEnum.default(SessionStatus.PLANIFIE),
    planningJson: z.any().optional(),
}).refine(data => new Date(data.dateDebut) <= new Date(data.dateFin), {
    message: "La date de fin doit être après la date de début",
    path: ["dateFin"],
});

export type SessionInput = z.infer<typeof SessionSchema>;
