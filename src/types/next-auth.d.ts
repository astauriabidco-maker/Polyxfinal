/**
 * NextAuth Type Augmentations
 * ===========================
 * Les types NextAuth (Session, User, JWT) sont étendus dans :
 *   src/lib/auth/types.ts
 *
 * Ce fichier existe pour que TypeScript détecte les augmentations globales.
 * NE PAS redéfinir les types ici — utiliser lib/auth/types.ts comme source unique.
 */

// Side-effect import : charge les augmentations de module
import '@/lib/auth/types';

export { };
