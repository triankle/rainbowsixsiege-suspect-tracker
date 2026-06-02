# Documentation sécurité

## Modèle de sécurité

R6 Suspect Check utilise une authentification stateless par JWT, avec utilisateurs stockés dans PostgreSQL et rôles RBAC (`admin`, `moderator`, `viewer`). Les anciennes clés `SAVE_API_KEY` et `READ_API_KEY` restent acceptées comme compatibilité pour l'UI statique, mais les routes sensibles savent aussi valider un `Authorization: Bearer <token>`.

| Action | Protection |
| --- | --- |
| Enregistrer une analyse | Permission `submissions:create` (`admin`, `moderator`) ou header legacy `x-save-key`. |
| Lire l'historique | Permission `entries:read` (`admin`, `moderator`, `viewer`) ou header legacy `x-read-key`. |
| Lire les statistiques | Permission `stats:read` (`admin`, `moderator`, `viewer`) ou header legacy `x-read-key`. |
| Login | Mot de passe vérifié avec hash `scrypt`, utilisateur actif en base et JWT HMAC court. |
| Lire `/api/v1/auth/me` | Header `Authorization: Bearer <token>`. |
| Logout | Incrémente `tokenVersion` en base pour révoquer les JWT existants. |
| Accéder à PostgreSQL | Impossible depuis le client ; `DATABASE_URL` reste côté serveur. |

## Secrets

Les secrets ne sont pas versionnés. Les fichiers suivants sont ignorés par Git :

- `.env`
- `.env.local`
- `.env*.local`
- `.vercel`

Les secrets de production sont injectés dans Vercel Environment Variables :

- `DATABASE_URL`
- `SAVE_API_KEY`
- `READ_API_KEY`
- `AUTH_JWT_SECRET`

Le fichier `.env.example` contient uniquement des valeurs factices ou commentées.

## Authentification JWT et RBAC

Le seed crée trois utilisateurs de démonstration :

| Username | Rôle | Permissions |
| --- | --- | --- |
| `admin` | `admin` | Toutes les permissions applicatives. |
| `moderator` | `moderator` | Analyse, création, lecture, stats, export. |
| `viewer` | `viewer` | Analyse, lecture, stats, export. |

1. Les mots de passe ne sont jamais stockés en clair.
2. `prisma/seed.cjs` génère des hash `scrypt`.
3. `/api/v1/auth/login` vérifie l'utilisateur, le hash et le statut `isActive`.
4. Le JWT contient `sub`, `username`, `role`, `tokenVersion`, `iat` et `exp`.
5. `/api/v1/auth/me` recharge l'utilisateur en base et vérifie que `tokenVersion` correspond.
6. `/api/v1/auth/logout` incrémente `tokenVersion`, ce qui révoque les anciens JWT.

## Validation des entrées

Les endpoints utilisent `zod` via `lib/validation.js` :

- `analysisInputSchema` pour `POST /api/v1/analyze`.
- `submissionSchema` pour `POST /api/v1/submissions`.
- `entriesQuerySchema` pour `GET /api/v1/entries` et `GET /api/v1/export.csv`.
- `emptyQuerySchema` pour `GET /api/v1/stats`.
- `loginSchema` pour `POST /api/v1/auth/login`.

Les erreurs de validation retournent un JSON normalisé avec `field`, `code` et `message`.

## Gestion des erreurs

`lib/api-response.js` centralise :

- `AppError`
- `ValidationError`
- `AuthenticationError`
- `AuthorizationError`
- `ConfigurationError`
- `ConflictError`
- `NotFoundError`
- `handleApiError()`

En production, les erreurs internes sont masquées et ne renvoient pas de stacktrace au client.

## OWASP

### XSS

Le frontend statique échappe les valeurs utilisateur avant injection HTML via `escapeHtml()`. Le projet n'utilise pas de rendu HTML utilisateur volontaire.

### SQL injection

L'accès PostgreSQL passe par Prisma. Les filtres (`pseudo`, pagination) sont validés puis transmis à l'ORM, sans concaténation SQL.

### CSRF

L'application n'utilise pas de cookie de session. Les actions d'écriture reposent sur un header personnalisé `x-save-key`, ce qui n'est pas envoyé automatiquement par un navigateur tiers comme un cookie.

### Headers HTTP

`next.config.ts` applique les headers globaux suivants via `headers()` :

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`

Les endpoints API ajoutent aussi les headers de base via `setSecurityHeaders()`, avec HSTS en production.

## CI sécurité

Le workflow GitHub Actions lance Gitleaks pour détecter les secrets accidentellement commités, puis exécute validation Prisma, tests et build.

## Limites assumées

- Pas de self-service public pour créer des comptes ; les utilisateurs sont seedés ou administrés côté base.
- Pas de rate limiting applicatif dédié ; Vercel fournit une première couche d'isolation, mais une protection dédiée serait nécessaire pour une app publique à fort trafic.
- La CSP autorise `unsafe-inline` pour conserver le HTML statique actuel ; une migration vers scripts/styles hashés permettrait de la durcir davantage.
