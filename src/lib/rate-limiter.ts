/**
 * RATE LIMITER — Sliding Window en mémoire
 * ==========================================
 * Implémente un rate limiting par fenêtre glissante (1 heure).
 * Chaque clé (ex: partnerId) a son propre compteur.
 *
 * Pour une mise à l'échelle multi-instance :
 *   → Remplacer le Map par Redis (ZADD + ZRANGEBYSCORE)
 *
 * Headers HTTP retournés :
 *   X-RateLimit-Limit     → Quota total par fenêtre
 *   X-RateLimit-Remaining → Requêtes restantes
 *   X-RateLimit-Reset     → Timestamp (secondes) du prochain reset
 */

// ─── Types ────────────────────────────────────────────────────

interface RateLimitEntry {
    timestamps: number[];    // Timestamps des requêtes dans la fenêtre
    lastCleanup: number;     // Dernier nettoyage
}

export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: number;         // Unix timestamp (seconds)
    retryAfterMs: number;    // Millisecondes avant la prochaine fenêtre libre
}

// ─── Configuration ────────────────────────────────────────────

const WINDOW_MS = 60 * 60 * 1000;  // 1 heure en millisecondes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Nettoyage toutes les 5 minutes
const STORE_MAX_SIZE = 10_000; // Limite de sécurité pour la mémoire

// ─── Store global (survit aux requêtes dans le même processus) ─

const store = new Map<string, RateLimitEntry>();
let lastGlobalCleanup = Date.now();

// ─── Fonctions ────────────────────────────────────────────────

/**
 * Vérifie si une requête est autorisée pour une clé donnée.
 * Utilise un algorithme de fenêtre glissante (sliding window log).
 *
 * @param key       Identifiant unique (ex: partnerId)
 * @param maxRequests  Nombre max de requêtes par fenêtre (ex: partner.rateLimit)
 * @returns         RateLimitResult avec le statut et les headers
 */
export function checkRateLimit(key: string, maxRequests: number): RateLimitResult {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    // Nettoyage global périodique pour éviter les fuites mémoire
    if (now - lastGlobalCleanup > CLEANUP_INTERVAL_MS) {
        cleanupExpiredEntries(windowStart);
        lastGlobalCleanup = now;
    }

    // Récupérer ou créer l'entrée
    let entry = store.get(key);
    if (!entry) {
        entry = { timestamps: [], lastCleanup: now };
        store.set(key, entry);
    }

    // Nettoyer les timestamps hors de la fenêtre
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
    entry.lastCleanup = now;

    // Calculer le reset (quand le plus ancien timestamp sortira de la fenêtre)
    const oldestInWindow = entry.timestamps.length > 0 ? entry.timestamps[0] : now;
    const resetAt = Math.ceil((oldestInWindow + WINDOW_MS) / 1000); // Unix seconds

    // Vérifier la limite
    if (entry.timestamps.length >= maxRequests) {
        // ❌ Rate limit dépassé
        const retryAfterMs = oldestInWindow + WINDOW_MS - now;

        return {
            allowed: false,
            limit: maxRequests,
            remaining: 0,
            resetAt,
            retryAfterMs: Math.max(retryAfterMs, 1000), // Minimum 1 seconde
        };
    }

    // ✅ Requête autorisée — enregistrer le timestamp
    entry.timestamps.push(now);

    return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - entry.timestamps.length,
        resetAt,
        retryAfterMs: 0,
    };
}

/**
 * Construit les headers HTTP standard pour le rate limiting.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetAt.toString(),
    };

    if (!result.allowed) {
        headers['Retry-After'] = Math.ceil(result.retryAfterMs / 1000).toString();
    }

    return headers;
}

/**
 * Nettoie les entrées expirées de toutes les clés.
 * Appelé périodiquement pour éviter les fuites mémoire.
 */
function cleanupExpiredEntries(windowStart: number): void {
    let cleaned = 0;

    const entries = Array.from(store.entries());
    for (const [key, entry] of entries) {
        // Filtrer les timestamps expirés
        entry.timestamps = entry.timestamps.filter((ts: number) => ts > windowStart);

        // Supprimer les entrées vides (partenaire inactif)
        if (entry.timestamps.length === 0) {
            store.delete(key);
            cleaned++;
        }
    }

    // Sécurité : si le store dépasse la taille max, purger les plus anciens
    if (store.size > STORE_MAX_SIZE) {
        const entries = Array.from(store.entries())
            .sort((a, b) => a[1].lastCleanup - b[1].lastCleanup);

        const toRemove = entries.slice(0, store.size - STORE_MAX_SIZE);
        for (const [key] of toRemove) {
            store.delete(key);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`[RateLimiter] 🧹 Nettoyage: ${cleaned} entrées supprimées, ${store.size} actives`);
    }
}

/**
 * Réinitialise le compteur pour une clé donnée.
 * Utile lors de la régénération de clé API ou la modification du rateLimit.
 */
export function resetRateLimit(key: string): void {
    store.delete(key);
}

/**
 * Retourne les stats du rate limiter (pour monitoring).
 */
export function getRateLimiterStats(): { totalKeys: number; totalTimestamps: number } {
    let totalTimestamps = 0;
    const values = Array.from(store.values());
    for (const entry of values) {
        totalTimestamps += entry.timestamps.length;
    }
    return { totalKeys: store.size, totalTimestamps };
}
