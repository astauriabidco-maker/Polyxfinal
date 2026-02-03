# STACK TECHNIQUE & CONTRAT D'ARCHITECTURE

## CORE
- **Framework** : Next.js 14+ (App Router).
- **Language** : TypeScript (Strict mode).
- **Database** : PostgreSQL.
- **ORM** : Prisma (Schema-first design).

## SERVICES SPÉCIFIQUES
- **Compliance Engine** : Service TypeScript pur, découplé de l'UI.
- **PDF Generation** : `@react-pdf/renderer` (Templating React).
- **Auth & RBAC** : NextAuth.js (v5) + Middleware personnalisé pour les "Gates".
- **Validation** : Zod (Pour valider les règles JSON et les inputs).

## ARCHITECTURE PATTERNS
- **Event-Driven** : Utilisation d'événements pour les logs d'audit (ex: `on('contract_signed') -> createAuditLog()`).
- **Repository Pattern** : Isolation de l'accès BDD.
- **Feature Flags** : Gestion des règles via le moteur JSON.
