/**
 * PRISMA SINGLETON
 * =================
 * Instance unique de PrismaClient pour éviter l'épuisement du pool de connexions.
 * 
 * Utilise globalThis pour survivre au hot-reload de Next.js en développement.
 */

import { PrismaClient } from '@prisma/client';

// Type pour stocker Prisma dans l'objet global
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Singleton : réutilise l'instance existante ou en crée une nouvelle
export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

// En développement, persiste l'instance dans globalThis
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

/**
 * Récupère l'instance Prisma singleton
 */
export function getPrisma(): PrismaClient {
    return prisma;
}

/**
 * Définit l'instance Prisma (pour les tests)
 */
export function setPrisma(instance: PrismaClient): void {
    globalForPrisma.prisma = instance;
}

/**
 * Reset l'instance (pour les tests - ATTENTION: uniquement en test)
 */
export function resetPrisma(): void {
    globalForPrisma.prisma = undefined;
}

export default prisma;

