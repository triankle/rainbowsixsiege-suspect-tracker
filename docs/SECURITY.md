# Documentation sécurité

## Modèle de sécurité

R6 Suspect Check n'a pas de comptes publics multi-utilisateurs. Le modèle choisi est stateless : le navigateur appelle des fonctions serverless Vercel, les actions sensibles sont protégées par des clés configurées côté serveur, et une authentification admin JWT de démonstration permet de valider le parcours login sécurisé.

| Action | Protection |
| --- | --- |
| Enregistrer une analyse | Header `x-save-key` comparé à `SAVE_API_KEY`. |
| Lire l'historique | Header `x-read-key` comparé à `READ_API_KEY`. |
| Lire les statistiques | Public, uniquement agrégé. |
| Login admin | Mot de passe vérifié avec hash `scrypt` et JWT HMAC court. |
| Lire `/api/v1/auth/me` | Header `Authorization: Bearer <token>`. |
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
- `AUTH_USERNAME`
- `AUTH_PASSWORD_HASH`
- `AUTH_JWT_SECRET`

Le fichier `.env.example` contient uniquement des valeurs factices ou commentées.

## Authentification admin JWT

Le projet fournit une authentification admin légère pour démontrer le critère sécurité sans introduire de comptes publics multi-utilisateurs :

1. Le mot de passe admin n'est jamais stocké en clair.
2. `npm run auth:hash -- "mot-de-passe-long"` génère un hash `scrypt`.
3. `/api/v1/auth/login` vérifie le hash avec comparaison en temps constant.
4. `/api/v1/auth/me` vérifie un JWT HMAC SHA-256 avec expiration courte de 15 minutes.
5. Les secrets sont lus depuis l'environnement et doivent être injectés par l'hébergeur.

## Validation des entrées

Les endpoints utilisent `zod` via `lib/validation.js` :

- `submissionSchema` pour `POST /api/submissions`.
- `entriesQuerySchema` pour `GET /api/entries`.
- `emptyQuerySchema` pour `GET /api/stats`.
- `loginSchema` pour `POST /api/v1/auth/login`.

Les erreurs de validation retournent un JSON normalisé avec `field`, `code` et `message`.

## Gestion des erreurs

`lib/api-response.js` centralise :

- `AppError`
- `ValidationError`
- `AuthenticationError`
- `ConfigurationError`
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

`next.config.ts` définit les headers globaux suivants :

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`

Les endpoints API ajoutent aussi les headers de base via `setSecurityHeaders()`.

## CI sécurité

Le workflow GitHub Actions lance Gitleaks pour détecter les secrets accidentellement commités, puis exécute validation Prisma, tests et build.

## Limites assumées

- Pas de comptes utilisateurs, donc pas de RBAC complet.
- Pas de rate limiting applicatif dédié ; Vercel fournit une première couche d'isolation, mais une protection dédiée serait nécessaire pour une app publique à fort trafic.
- La CSP autorise `unsafe-inline` pour conserver le HTML statique actuel ; une migration vers scripts/styles hashés permettrait de la durcir davantage.
