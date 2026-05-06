# R6 Suspect Check
Site web pour estimer si un profil Rainbow Six Siege est **suspect (triche)** ou **type smurf**, à partir des stats qu’on peut voir sur [R6 Tracker](https://r6.tracker.network/).

## Spécifications fonctionnelles

### Objectif

R6 Suspect Check aide un joueur ou un modérateur à analyser rapidement un profil Rainbow Six Siege à partir de statistiques ranked copiées depuis R6 Tracker. L'outil ne prouve pas la triche : il produit une estimation indicative séparant les signaux **cheat-like**, **smurf-like** et **profil propre**.

### Cas d'usage principaux

1. **Analyser un profil ranked**
   - L'utilisateur saisit le pseudo optionnel, le K/D ranked, le win rate ranked, le nombre de matchs ranked, le niveau du compte, le rang actuel et les saisons jouées.
   - Le formulaire bloque les profils incohérents, par exemple un niveau inférieur à 50 ou aucune saison cochée.
   - L'application calcule un verdict, un score de suspicion, un score smurf, une classification et une liste de raisons explicites.

2. **Sauvegarder une analyse**
   - Après l'analyse, l'utilisateur peut enregistrer le résultat dans PostgreSQL via `POST /api/submissions`.
   - Si `SAVE_API_KEY` est configurée côté serveur, l'utilisateur doit fournir la clé de sauvegarde.

3. **Consulter l'historique**
   - Le lien **Show stored entries** ouvre `/entries`.
   - La page dédiée charge les analyses sauvegardées via `GET /api/entries` et affiche un tableau filtrable visuellement par colonnes.
   - Si `READ_API_KEY` est configurée côté serveur, l'utilisateur doit fournir la clé de lecture.

### MVP

Le MVP est complet si l'utilisateur peut :

- saisir manuellement les statistiques ranked ;
- obtenir un verdict argumenté sans recharger la page ;
- sauvegarder une analyse dans PostgreSQL ;
- consulter les analyses sauvegardées sur `/entries` ;
- lancer le projet localement avec `npm run dev`.

### Hors périmètre assumé

- Pas de preuve de triche automatisée.
- Pas de scraping R6 Tracker : le site bloque les accès automatisés et l'API publique n'est pas disponible sans accord/clé adaptée.
- Pas de comptes utilisateurs : l'application utilise une clé optionnelle `SAVE_API_KEY` pour protéger l'écriture.

## Architecture

```text
Navigateur
  ├─ public/index.html + public/script.js
  │    ├─ validation formulaire
  │    ├─ analyse heuristique locale
  │    └─ POST /api/submissions
  │
  └─ public/entries.html ou app/entries/page.tsx
       └─ GET /api/entries

API serverless Vercel / serveur local
  ├─ api/submissions.js  → validation + insertion Prisma
  └─ api/entries.js      → lecture Prisma

Couche données
  ├─ lib/node-prisma.js / lib/prisma.ts
  ├─ prisma/schema.prisma
  └─ PostgreSQL : suspect_submissions
```

### Choix techniques

**HTML/CSS/JavaScript vanilla (`public/`)** : l'outil principal est volontairement léger et directement servable par Vercel ou par le serveur local. Cela limite la complexité côté client et rend le formulaire utilisable même sans hydration React.

**Next.js App Router (`app/`)** : Next fournit une compatibilité Vercel propre, une page server-rendered pour l'historique et une base évolutive si l'application doit ensuite intégrer plus de pages.

**API serverless Vercel (`api/`)** : les endpoints `submissions` et `entries` isolent l'accès base de données du navigateur. Le front ne manipule jamais directement la chaîne PostgreSQL.

**Prisma** : Prisma évite le SQL concaténé, fournit un modèle typé côté Next et centralise l'accès à PostgreSQL via `SuspectSubmission`.

**PostgreSQL** : le projet stocke des analyses structurées avec scores numériques, tableau de saisons jouées et JSON de raisons. PostgreSQL est adapté aux requêtes d'historique et au stockage durable.

**Serveur local Node (`scripts/local-dev.cjs`)** : il reproduit localement le routage statique + API sans dépendre de Vercel CLI, ce qui facilite les tests en soutenance.

## Structure du dépôt

```
├── public/              ← Outil principal (HTML, CSS, JS, musique) — servi à / en dev et par Next en prod
├── api/                 ← Serverless Vercel : /api/submissions (POST) + /api/entries (GET)
├── app/                 ← Next.js (App Router) — page / historique optionnelle
├── lib/                 ← Client Prisma (Next + Node)
├── prisma/              ← schéma Prisma + réexports
├── db/                  ← schema.sql PostgreSQL
├── scripts/             ← local-dev.cjs (npm run dev)
├── docs/
│   └── DOCUMENTATION.md ← doc soutenance (architecture, inventaire détaillé)
├── package.json
└── README.md
```

## Critères utilisés

- **Suspicion triche** : K/D très élevé avec peu de parties, win rate très haut avec peu de jeux.
- **Smurf** : rang élevé avec niveau compte bas, peu de parties pour le rang, peu de saisons jouées.
- **Profil propre** : beaucoup de parties, plusieurs saisons, K/D dans la norme.

## Fichiers utiles

- `public/index.html` — structure de la page (formulaire + zone résultat + lien vers les entrées).
- `public/entries.html` — page dédiée affichant les analyses sauvegardées.
- `public/styles.css` — mise en forme (thème sombre type R6).
- `public/script.js` — calcul des scores et affichage du résultat.
- `api/submissions.js` — route serverless : enregistrement via **Prisma**.
- `api/entries.js` — route serverless : lecture des entrées via **Prisma**.
- `prisma/schema.prisma` — modèle `SuspectSubmission` ↔ table `suspect_submissions`.
- `lib/prisma.ts` — client Prisma pour Next.js ; `lib/node-prisma.js` — `getPrisma()` pour `api/*.js` (évite le conflit de nom avec `@/lib/prisma`).
- `db/schema.sql` — équivalent SQL à exécuter une fois sur Neon si tu n’utilises pas `db push`.
- `package.json` — scripts `db:*` et génération du client au `npm install`.
- `docs/DOCUMENTATION.md` — documentation détaillée pour soutenance / onboarding.

## Sauvegarde PostgreSQL (optionnelle)

Après une analyse, un bloc **Save to database** permet d’envoyer les champs + scores à une API. Il faut :

1. Créer une base PostgreSQL (Neon, Supabase, Vercel Postgres, etc.).
2. Exécuter `db/schema.sql` sur cette base.
3. Définir la variable d’environnement **`DATABASE_URL`** là où l’API tourne (voir Vercel ci‑dessous).
4. Optionnel : **`SAVE_API_KEY`** — si elle est définie, l’API exige l’en-tête `x-save-key` avec la même valeur ; le champ mot de passe sous le bouton sert à ça.
5. Optionnel en local, recommandé en production : **`READ_API_KEY`** — protège `GET /api/entries` via l'en-tête `x-read-key`.

## Prisma

- Après **`npm install`**, **`prisma generate`** tourne automatiquement (`postinstall`) : le client est prêt pour l’API et pour Vercel (`vercel-build` = `prisma generate`).
- **`npm run db:validate`** — vérifie le schéma (utilise `.env.example` pour une `DATABASE_URL` factice).
- **`npm run db:push`** — pousse le schéma vers la base pointée par **`.env.local`** (alternative à exécuter `db/schema.sql` à la main). Ne lance pas ça sur une base de prod sans réfléchir aux effets.
- **`npm run db:pull`** — met à jour `schema.prisma` depuis une base existante (introspection).

Tu n’as **rien à refaire** si la table existe déjà : l’insertion **Save to database** utilise le même nom de table et les mêmes colonnes.

## Données de démonstration

Un seed Prisma est fourni pour remplir rapidement la table `suspect_submissions` avec trois profils de démonstration :

```bash
npm run db:seed
```

Le seed nécessite une `DATABASE_URL` valide dans `.env.local` et sert uniquement à tester l'historique en local ou en environnement de démonstration.

## Sécurité

- **XSS** : toutes les valeurs utilisateur réinjectées dans le DOM passent par `escapeHtml()` avant `innerHTML`.
- **SQL injection** : l'application utilise Prisma (`create`, `findMany`) et ne concatène pas de requêtes SQL à partir de paramètres utilisateur.
- **CSRF** : l'API n'utilise pas de cookie de session ; l'écriture est stateless et peut être protégée par l'en-tête `x-save-key` via `SAVE_API_KEY`.
- **Autorisation lecture/écriture** : `SAVE_API_KEY` protège l'écriture et `READ_API_KEY` protège l'historique en production.
- **Headers HTTP** : `next.config.ts` définit CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` et `Permissions-Policy`.
- **Secrets** : `.env`, `.env.local` et `.env*.local` sont ignorés par Git ; seules les variables d'exemple doivent être versionnées.

## Vercel : compatibilité et déploiement

L’architecture actuelle est **compatible Vercel** :

- Les fichiers statiques sont dans **`public/`** : Next.js les expose à la racine des URL (`/index.html`, `/styles.css`, …) ; **`npm run dev`** sert aussi ce dossier à la racine.
- Le dossier **`api/`** devient des **Serverless Functions** (`/api/submissions`, `/api/entries`).

Étapes typiques :

1. Installer les deps : `npm install`
2. Lier le projet : `npx vercel` (ou import du dépôt Git dans le dashboard Vercel).
3. Dans **Project → Settings → Environment Variables**, ajouter `DATABASE_URL`, `SAVE_API_KEY` et `READ_API_KEY`.
4. Redéployer.

Le workflow GitHub Actions `.github/workflows/ci.yml` installe les dépendances, valide le schéma Prisma et lance le build à chaque push ou pull request vers `main`. Sur Vercel, un push sur `main` peut ensuite déclencher le déploiement automatique du projet lié.

En local, **`vercel dev`** démarre le même routage que en prod (statique + `/api/*`) et lit `.env.local` (copie `.env.example` → `.env.local`).

Ouvrir seulement `public/index.html` en `file://` ne permet pas d’appeler `/api/submissions` ou `/api/entries` ; utilise `npm run dev`, `npx vercel dev` ou un déploiement.

## Lancer en local

**Sans base de données** — page statique seule (API indisponible) :

```bash
cd public
python -m http.server 8000
# Puis http://localhost:8000
```

**Avec API + PostgreSQL** (recommandé si tu testes la sauvegarde) :

```bash
npm install
# Renseigne DATABASE_URL dans .env.local
npm run dev
# → http://localhost:3000 (racine = public/index.html + /entries + /api/submissions + /api/entries)
```

Alternative : `npx vercel dev` si tu préfères le même runtime que en production.

## Page Next.js (historique en base)

- **`app/page.tsx`** — Server Component : lit **`suspect_submissions`** avec Prisma et affiche un tableau (jusqu’à 200 lignes).
- **`npm run next:dev`** — lance Next sur **http://localhost:3001** ; l’outil formulaire est aussi disponible en **`http://localhost:3001/index.html`** (fichiers `public/`). Pour API + statique comme en prod Vercel, préfère **`npm run dev`** (port **3000**) ou **`npx vercel dev`**.
- Next charge automatiquement **`.env.local`** pour **`DATABASE_URL`**.

Build production Next : **`npm run next:build`**.

---

*Stats à saisir manuellement depuis R6 Tracker. Résultat à titre indicatif uniquement.*
