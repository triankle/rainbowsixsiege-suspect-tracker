# R6 Suspect Check

![CI](https://github.com/triankle/rainbowsixsiege-suspect-tracker/actions/workflows/ci.yml/badge.svg)

R6 Suspect Check aide à repérer les profils Rainbow Six Siege qui méritent une vérification manuelle à partir de statistiques ranked copiées depuis R6 Tracker. L'application distingue les signaux **cheat-like**, **smurf-like** et **profil propre**, puis permet de sauvegarder les analyses dans PostgreSQL.

## Démo en ligne

Application déployée : https://suspecttracker-rayanpotteratres-7933s-projects.vercel.app


## Captures d'écran

Les captures peuvent être ajoutées dans `docs/screenshots/` avant la soutenance :

- `docs/screenshots/home.png` — formulaire principal d'analyse.
- `docs/screenshots/result.png` — résultat d'une analyse.
- `docs/screenshots/entries.png` — historique PostgreSQL.

## Spécifications fonctionnelles

### Pitch

Les joueurs et modérateurs R6 perdent du temps à interpréter des profils ranked ambigus. R6 Suspect Check transforme quelques statistiques visibles sur R6 Tracker en verdict argumenté, sauvegardable et consultable en ligne.

### Personae cibles

- **Joueur ranked** : veut savoir si un adversaire paraît suspect avant de signaler trop vite.
- **Modérateur de communauté** : veut centraliser des analyses rapides pendant une vérification manuelle.
- **Évaluateur projet** : veut tester un parcours complet frontend, API, base de données et déploiement.

### MVP

1. En tant que joueur ranked, je veux saisir les statistiques d'un profil afin d'obtenir un score de suspicion compréhensible.
2. En tant que joueur ranked, je veux voir les raisons du verdict afin de comprendre les signaux retenus.
3. En tant que joueur ranked, je veux copier un rapport partageable afin de transmettre le résultat sans capture manuelle.
4. En tant que modérateur, je veux sauvegarder une analyse afin de conserver une trace dans PostgreSQL.
5. En tant que modérateur, je veux consulter l'historique afin de comparer les profils déjà vérifiés.
6. En tant qu'évaluateur, je veux lire des statistiques agrégées afin de confirmer que la base de données est connectée.

### Out of scope

- L'application ne prouve pas une triche : elle produit uniquement une aide à la décision.
- L'application ne scrape pas R6 Tracker et n'utilise pas d'API Ubisoft privée.
- L'application ne gère pas de comptes utilisateurs, rôles ou sessions.
- L'application ne remplace pas une investigation humaine ou une preuve vidéo.
- L'application ne stocke pas de données personnelles sensibles.

### Parcours utilisateur principal

1. Ouvrir `/` ou `/index.html` sur l'URL Vercel.
2. Renseigner le pseudo optionnel, K/D, win rate, matchs ranked, niveau, rang et saisons jouées.
3. Lire le verdict, les scores et les raisons détaillées affichés dans la page.
4. Utiliser **Copy report** pour copier un rapport texte partageable.
5. Utiliser **Save to database** avec la clé de sauvegarde si la persistance doit être testée.
6. Ouvrir `/entries` pour consulter l'historique sauvegardé avec la clé de lecture.
7. Ouvrir `/api/v1/stats` pour vérifier les statistiques agrégées de la base.

## Architecture

```mermaid
graph LR
  U[Utilisateur navigateur] -->|HTTPS| F[Frontend statique public/index.html sur Vercel]
  F -->|JS local| H[Moteur heuristique lib/analyze.js]
  F -->|POST JSON + x-save-key| S[/api/v1/submissions Serverless Node.js]
  F -->|GET + x-read-key| E[/api/v1/entries Serverless Node.js]
  U -->|GET| N[Next.js App Router /entries]
  U -->|GET| A[/api/v1/stats Serverless Node.js]
  S -->|Prisma ORM| P[(PostgreSQL Neon)]
  E -->|Prisma ORM| P
  A -->|Prisma aggregate/groupBy| P
  N -->|Prisma ORM| P
```

### Choix techniques

**HTML/CSS/JavaScript vanilla** — Le formulaire principal reste très léger, rapide à charger et facile à démontrer sans hydration complexe. L'alternative aurait été une SPA React complète, plus structurée mais plus coûteuse à maintenir pour un MVP centré sur un seul écran. L'inconvénient assumé est une componentisation plus faible.

**Next.js 15** — Next.js permet d'héberger proprement le projet sur Vercel, de servir les fichiers `public/` et d'ajouter des pages App Router comme `/entries`. Une app Express séparée aurait été plus contrôlable mais aurait demandé un hébergement backend dédié. L'inconvénient est une architecture hybride entre statique et App Router.

**Vercel Serverless Functions** — Les fichiers `api/*.js` deviennent des endpoints HTTPS sans serveur à administrer. Render ou Railway auraient aussi fonctionné, mais Vercel donne le déploiement automatique depuis GitHub. La limite est le modèle serverless : cold starts possibles et temps d'exécution encadré.

**Prisma** — Prisma évite les requêtes SQL concaténées, simplifie les accès typés et réduit le risque d'injection SQL. Une approche SQL manuelle aurait donné plus de contrôle sur les index et migrations. L'inconvénient est une dépendance ORM et un client à générer au build.

**PostgreSQL Neon** — Neon fournit une base PostgreSQL managée gratuite adaptée au stockage durable des analyses. SQLite aurait été plus simple en local, mais moins adapté au déploiement serverless. L'inconvénient est la dépendance réseau et le besoin de gérer `DATABASE_URL`.

**Zod** — Zod centralise la validation serveur des body et query params. Une validation manuelle aurait réduit les dépendances, mais elle devient vite incohérente entre endpoints. L'inconvénient est un coût d'apprentissage et quelques transformations explicites.

### Limites connues

- Le frontend principal n'est pas encore découpé en composants React réutilisables.
- La CSP conserve `unsafe-inline` pour rester compatible avec le HTML statique actuel.
- Le projet n'a pas d'authentification utilisateur complète, seulement des clés API de démonstration.
- Il n'y a pas de domaine personnalisé ; le TLS est fourni par Vercel sur `vercel.app`.
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

1. Cloner le dépôt.

   ```bash
   git clone https://github.com/triankle/rainbowsixsiege-suspect-tracker.git
   cd rainbowsixsiege-suspect-tracker
   ```

2. Installer les dépendances.

   ```bash
   npm install
   ```

3. Créer l'environnement local.

   ```bash
   cp .env.example .env.local
   ```

4. Renseigner `DATABASE_URL` dans `.env.local` si la sauvegarde doit fonctionner.

5. Préparer la base.

   ```bash
   npm run db:push
   npm run db:seed
   ```

6. Lancer le serveur local.

   ```bash
   npm run dev
   ```

7. Ouvrir l'application.

   ```text
   http://localhost:3000
   http://localhost:3000/entries
   ```

Alternative Next.js seule :

```bash
npm run next:dev
```

## Variables d'environnement

| Nom | Rôle | Exemple | Requise |
| --- | --- | --- | --- |
| `DATABASE_URL` | Connexion PostgreSQL Neon/Supabase/Vercel Postgres | `postgresql://user:password@host/db?sslmode=require` | Oui pour API DB |
| `SAVE_API_KEY` | Protège `POST /api/submissions` via `x-save-key` | `r6-save-long-random-key` | Oui en production |
| `READ_API_KEY` | Protège `GET /api/entries` via `x-read-key` | `r6-read-long-random-key` | Oui en production |

## Tests

```bash
npm test
npm run check
```

`npm run check` vérifie la syntaxe des endpoints et librairies, valide Prisma, exécute les tests Jest et lance le build Next.js.

## Documentation complémentaire

- [Documentation API](docs/API.md)
- [Documentation base de données](docs/DB.md)
- [Documentation sécurité](docs/SECURITY.md)
- [Documentation frontend](docs/FRONTEND.md)
- [Workflow Git Flow](docs/GITFLOW.md)
- [Checklist release et soutenance](docs/RELEASE_CHECKLIST.md)
- [Documentation soutenance détaillée](docs/DOCUMENTATION.md)

## Choix techniques

Le projet privilégie un MVP déployable et explicable : formulaire statique pour l'expérience principale, serverless Vercel pour les endpoints, Prisma pour l'accès aux données et Neon pour PostgreSQL managé. La logique métier d'analyse est séparée dans `lib/analyze.js` afin de pouvoir être testée indépendamment du DOM. Les réponses API ont été renforcées avec validation Zod et erreurs JSON normalisées pour faciliter le débogage et la soutenance.

## Workflow Git recommandé

Le workflow cible pour les prochains chantiers est :

1. `main` reste la branche de production.
2. `dev` sert de branche d'intégration.
3. Chaque évolution part de `dev` via `feature/<nom>`.
4. Toute fusion vers `dev` ou `main` passe par Pull Request.
5. La CI doit être verte avant merge.

Le template de PR est disponible dans `.github/pull_request_template.md`.

## Déploiement

- Frontend, Next.js et fonctions API : Vercel.
- Base de données : Neon PostgreSQL.
- Variables de production : Vercel Environment Variables.
- Déploiement automatique : push sur `main` après CI verte.

## Sécurité

- Validation serveur via Zod.
- Accès base via Prisma, sans concaténation SQL.
- Secrets hors repo via Vercel Environment Variables.
- Headers HTTP globaux dans `next.config.ts`.
- Scan Gitleaks dans GitHub Actions.
- Lecture/écriture protégées par clés API en production.

## Limites connues

- Pas de login utilisateur ni RBAC complet.
- Pas de domaine custom pour le moment.
- Pas d'intégration directe avec R6 Tracker.
- Pas de modèle IA entraîné : l'analyse repose sur des règles heuristiques.
- Les captures d'écran doivent être ajoutées manuellement avant rendu final si demandées.

## License

Projet pédagogique. Aucune licence open source formelle n'est définie pour le moment.
