/**
 * EVIDENCE SERVER ACTIONS
 * =======================
 * Actions pour l'upload de preuves et justificatifs.
 * 
 * Les preuves permettent de débloquer des dossiers non-conformes
 * (ex: justificatif d'absence pour assiduité faible).
 * 
 * Sécurisé via NextAuth v5 session.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { TypePreuve, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import crypto from 'crypto';

interface AddProofResult {
    success: boolean;
    error?: string;
    proofId?: string;
}

/**
 * Ajoute une preuve à un dossier
 * 
 * @param dossierId - ID du dossier concerné
 * @param type - Type de preuve (TypePreuve enum)
 * @param description - Description de la preuve
 * @returns Résultat de l'opération
 */
export async function addProof(
    dossierId: string,
    type: TypePreuve,
    description: string
): Promise<AddProofResult> {
    // ========================================
    // 1. AUTHENTIFICATION (NextAuth v5)
    // ========================================
    const session = await auth();

    if (!session?.user) {
        throw new Error('Non authentifié. Veuillez vous connecter.');
    }

    const { id: userId, role: userRole, nom, prenom } = session.user;
    const now = new Date();

    // ========================================
    // 2. VÉRIFIER QUE LE DOSSIER EXISTE
    // ========================================
    const dossier = await prisma.dossier.findUnique({
        where: { id: dossierId },
        select: { id: true, stagiaireNom: true, stagiairePrenom: true },
    });

    if (!dossier) {
        throw new Error(`Dossier introuvable: ${dossierId}`);
    }

    // ========================================
    // 3. GÉNÉRER UN HASH FICTIF (simulation upload)
    // ========================================
    const fakeHash = crypto.randomBytes(32).toString('hex');
    const fakeFileName = `proof_${dossierId}_${type}_${Date.now()}.pdf`;
    const fakePath = `/uploads/proofs/${fakeFileName}`;

    // ========================================
    // 4. CRÉER L'ENTRÉE PREUVE
    // ========================================
    const preuve = await prisma.preuve.create({
        data: {
            type,
            dossierId,
            nomFichier: fakeFileName,
            cheminFichier: fakePath,
            mimeType: 'application/pdf',
            tailleFichier: 1024 * 50, // 50 KB fictif
            hashFichier: fakeHash,
            isSigned: false,
            dateGeneration: now,
            genereParId: userId,
        },
    });

    console.log(`[Evidence] ${prenom} ${nom} (${userRole}): Preuve créée ${preuve.id} (${type})`);

    // ========================================
    // 5. CRÉER ENTRÉE AUDITLOG
    // ========================================
    await prisma.auditLog.create({
        data: {
            entityType: 'Preuve',
            entityId: preuve.id,
            action: 'PROOF_UPLOAD',
            userId: userId,
            userRole: userRole as Role,
            niveauAction: 'EDITION',
            newState: {
                type,
                dossierId,
                description,
                fileName: fakeFileName,
                stagiaire: `${dossier.stagiairePrenom} ${dossier.stagiaireNom}`,
                uploadedBy: `${prenom} ${nom}`,
            },
            ipAddress: '127.0.0.1',
        },
    });

    console.log(`[Audit] Proof upload by ${prenom} ${nom} for dossier ${dossierId}`);

    // ========================================
    // 6. REVALIDATION DU CACHE
    // ========================================
    revalidatePath('/dashboard');

    return {
        success: true,
        proofId: preuve.id,
    };
}

/**
 * Récupère les types de preuves disponibles
 */
export async function getProofTypes(): Promise<TypePreuve[]> {
    return Object.values(TypePreuve) as TypePreuve[];
}

