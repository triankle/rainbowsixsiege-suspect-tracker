# R6 Suspect Check

![CI](https://github.com/triankle/rainbowsixsiege-suspect-tracker/actions/workflows/ci.yml/badge.svg)

R6 Suspect Check aide à analyser un profil Rainbow Six Siege ranked à partir de statistiques saisies manuellement, puis produit un verdict explicable entre profil propre, smurf probable et suspicion à vérifier.

## Démo en ligne

Application déployée : https://suspecttracker-rayanpotteratres-7933s-projects.vercel.app

Routes utiles :

- `/` ou `/index.html` : formulaire principal.
- `/entries` ou `/entries.html` : historique PostgreSQL.
- `/auth.html` : login JWT de démonstration si les variables `AUTH_*` sont configurées.

Compte de démonstration recommandé en local : `admin` / `Demo1234!Demo` après génération du hash avec `npm run auth:hash -- "Demo1234!Demo"`.

## Captures d'écran

Les captures sont à ajouter manuellement avant la soutenance dans `docs/screenshots/` :

- `docs/screenshots/home.png` : formulaire principal.
- `docs/screenshots/result.png` : résultat d'une analyse.
- `docs/screenshots/entries.png` : historique filtré.

## Spécifications fonctionnelles

### Pitch

Les joueurs et modérateurs R6 perdent du temps à interpréter des profils ranked ambigus. R6 Suspect Check transforme quelques statistiques visibles sur R6 Tracker en verdict argumenté, sauvegardable et consultable en ligne.

### Personae cibles

- **Joueur ranked** : veut savoir si un adversaire paraît suspect avant de signaler trop vite.
- **Modérateur de communauté** : veut centraliser des analyses pendant une vérification manuelle.
- **Évaluateur projet** : veut tester un parcours web complet avec frontend, API, base de données, sécurité et déploiement.

### MVP

1. En tant que joueur ranked, je veux saisir les statistiques d'un profil afin d'obtenir un verdict compréhensible.
2. En tant que joueur ranked, je veux voir les raisons détaillées afin de comprendre les signaux retenus.
3. En tant que joueur ranked, je veux copier un rapport partageable afin de transmettre l'analyse sans capture manuelle.
4. En tant que modérateur, je veux sauvegarder une analyse afin de conserver une trace dans PostgreSQL.
5. En tant que modérateur, je veux consulter l'historique afin de comparer les profils déjà vérifiés.
6. En tant que modérateur, je veux filtrer, trier et exporter l'historique afin de préparer une revue hors ligne.
7. En tant qu'évaluateur, je veux lire des statistiques agrégées afin de confirmer que la base est connectée.
8. En tant qu'administrateur, je veux tester un login JWT afin de vérifier le parcours d'authentification.

### Out of scope

- L'application ne prouve pas une triche : elle produit uniquement une aide à la décision.
- L'application ne scrape pas R6 Tracker et n'utilise pas d'API Ubisoft privée.
- L'application ne gère pas de comptes publics multi-utilisateurs ni de RBAC complet.
- L'application ne remplace pas une investigation humaine ou une preuve vidéo.
- L'application ne stocke pas de données personnelles sensibles.

### Parcours utilisateur principal

1. Ouvrir `/` ou `/index.html` sur l'URL Vercel.
2. Renseigner pseudo optionnel, K/D, win rate, matchs ranked, niveau, rang et saisons jouées.
3. Lire le verdict, les scores et les raisons affichés dans la page.
4. Utiliser **Copy report** pour copier un rapport texte.
5. Utiliser **Save to database** avec `SAVE_API_KEY` si la sauvegarde doit être testée.
6. Ouvrir `/entries` pour consulter l'historique avec `READ_API_KEY`.
7. Ouvrir `/api/v1/stats` avec `x-read-key` pour vérifier les agrégats.
8. Ouvrir `/auth.html` pour tester `/api/v1/auth/login` et `/api/v1/auth/me`.

## Architecture

```mermaid
graph LR
  browser["Navigateur desktop ou mobile"] -->|"HTTPS"| vercel["Vercel Next.js"]
  vercel -->|"sert fichiers statiques"| publicUi["public/index.html et public/entries.html"]
  vercel -->|"redirect statique"| nextRoutes["app/page.tsx et app/entries/page.tsx"]
  publicUi -->|"fetch JSON ou CSV"| apiCatchAll["api/[...path].js"]
  apiCatchAll -->|"validation Zod"| validation["lib/validation.js"]
  apiCatchAll -->|"services métier"| services["lib/services/submission-service.js"]
  services -->|"analyse serveur"| analyze["lib/analyze.js"]
  services -->|"repository Prisma"| repository["lib/repositories/submission-repository.js"]
  repository -->|"requêtes ORM"| postgres["PostgreSQL Neon"]
  publicUi -->|"lien externe manuel"| r6Tracker["R6 Tracker"]
```

### Choix techniques

**HTML/CSS/JavaScript vanilla** : le parcours principal reste très léger et fonctionne sans hydration React complexe. Une SPA React aurait donné une meilleure componentisation, mais aurait augmenté le coût de maintenance pour un MVP centré sur un seul formulaire. L'inconvénient accepté est une componentisation visuelle encore limitée, compensée par un appel API serveur pour l'analyse.

**Next.js 15 sur Vercel** : Next sert les fichiers statiques, ajoute les headers globaux et permet le déploiement automatique. Une app Express séparée aurait donné plus de contrôle backend, mais aurait demandé un hébergement serveur distinct. L'inconvénient est une architecture hybride entre statique, App Router minimal et fonctions serverless.

**Fonction Vercel catch-all** : tous les endpoints sont regroupés dans `api/[...path].js` afin de rester sous la limite Hobby de fonctions serverless. Des fichiers API séparés seraient plus lisibles, mais créeraient trop de fonctions pour ce plan. L'inconvénient est un routeur manuel plus long.

**Prisma** : l'accès PostgreSQL passe par un ORM, sans concaténation SQL utilisateur. Des requêtes SQL manuelles auraient offert plus de contrôle, mais augmenteraient le risque d'injection et la duplication. L'inconvénient est le besoin de générer le client Prisma au build.

**PostgreSQL Neon** : Neon fournit une base managée gratuite adaptée aux fonctions serverless. SQLite serait plus simple localement, mais ne convient pas au déploiement Vercel. L'inconvénient est la dépendance réseau et la gestion de `DATABASE_URL`.

**Zod** : les bodies et query params sont validés avant toute logique métier. Une validation manuelle aurait réduit les dépendances, mais elle devient vite incohérente entre endpoints. L'inconvénient est un peu de boilerplate de schéma.

### Limites connues

- Le frontend vanilla n'est pas encore découpé en composants réutilisables, mais il ne duplique plus le moteur d'analyse.
- La CSP conserve `unsafe-inline` pour rester compatible avec le HTML statique actuel.
- L'auth JWT est une démonstration admin, pas une gestion complète d'utilisateurs.
- Le domaine custom et les protections de branches GitHub doivent être configurés manuellement.
- Les heuristiques sont explicables mais ne sont pas un modèle statistique entraîné.

## Stack

- Node.js `>=18`
- Next.js `^15.1.6`
- React `^19.0.0`
- Prisma `^6.19.0`
- PostgreSQL Neon
- Zod `^4.4.3`
- Jest `^30.3.0`
- Vercel
- GitHub Actions

## Lancer en local

1. Prérequis : Node.js 18+, npm, une base PostgreSQL si la persistance doit fonctionner.
2. Cloner le dépôt.

   ```bash
   git clone https://github.com/triankle/rainbowsixsiege-suspect-tracker.git
   cd rainbowsixsiege-suspect-tracker
   ```

3. Installer les dépendances.

   ```bash
   npm install
   ```

4. Créer l'environnement local.

   ```bash
   cp .env.example .env.local
   ```

5. Renseigner `DATABASE_URL`, `SAVE_API_KEY`, `READ_API_KEY` et les variables `AUTH_*` dans `.env.local`.

6. Préparer la base.

   ```bash
   npm run db:push
   npm run seed
   ```

7. Lancer le serveur local.

   ```bash
   npm run dev
   ```

8. Ouvrir `http://localhost:3000`, puis `http://localhost:3000/entries`.

## Variables d'environnement

| Nom | Rôle | Exemple | Requise |
| --- | --- | --- | --- |
| `DATABASE_URL` | Connexion PostgreSQL Neon/Supabase/Vercel Postgres | `postgresql://user:password@host/db?sslmode=require` | Oui pour API DB |
| `SAVE_API_KEY` | Protège `POST /api/v1/submissions` via `x-save-key` | `r6-save-long-random-key` | Oui en production |
| `READ_API_KEY` | Protège `GET /api/v1/entries`, `/api/v1/export.csv` et `/api/v1/stats` via `x-read-key` | `r6-read-long-random-key` | Oui en production |
| `AUTH_USERNAME` | Identifiant admin de démonstration JWT | `admin` | Oui pour `/api/v1/auth/*` |
| `AUTH_PASSWORD_HASH` | Hash scrypt du mot de passe admin | `scrypt$...` | Oui pour `/api/v1/auth/*` |
| `AUTH_JWT_SECRET` | Secret HMAC JWT de 32 caractères minimum | `change-me-with-32-random-chars-min` | Oui pour `/api/v1/auth/*` |

## Tests

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run vercel-build
npm run check
```

`npm run check` vérifie la syntaxe, valide Prisma, exécute les tests Jest, le test E2E Playwright, le lint, le typecheck et le build.

## Choix techniques

Le projet privilégie un MVP déployable et défendable : formulaire statique pour la démonstration, API serverless unique pour Vercel Hobby, service métier côté serveur pour recalculer les verdicts, Prisma pour la persistance et Zod pour valider chaque entrée. La logique d'analyse vit dans `lib/analyze.js`, réutilisée par les tests, par `POST /api/v1/analyze` et par `POST /api/v1/submissions`, ce qui évite toute divergence entre affichage et sauvegarde.

## Documentation complémentaire

- [Documentation API](docs/API.md)
- [Documentation base de données](docs/DB.md)
- [Documentation sécurité](docs/SECURITY.md)
- [Documentation frontend](docs/FRONTEND.md)
- [Workflow Git Flow](docs/GITFLOW.md)
- [Roadmap XP](docs/XP_ROADMAP.md)
- [Checklist release et soutenance](docs/RELEASE_CHECKLIST.md)
- [Documentation soutenance détaillée](docs/DOCUMENTATION.md)

## Limites connues

- Pas de domaine custom configuré dans le repo.
- Pas de compte utilisateur public ni de RBAC complet.
- Pas d'intégration automatique avec R6 Tracker.
- Pas de screenshots versionnés pour le moment.
- Pas de migrations Prisma historiques : le setup local utilise `prisma db push`.

## License

Projet pédagogique. Aucune licence open source formelle n'est définie pour le moment.
