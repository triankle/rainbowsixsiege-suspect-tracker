# R6 Suspect Check
Site web pour estimer si un profil Rainbow Six Siege est **suspect (triche)** ou **type smurf**, à partir des stats qu’on peut voir sur [R6 Tracker](https://r6.tracker.network/r6siege/profile/ubi/).

## Critères utilisés

- **Suspicion triche** : K/D très élevé avec peu de parties, win rate très haut avec peu de jeux.
- **Smurf** : rang élevé avec niveau compte bas, peu de parties pour le rang, peu de saisons jouées.
- **Profil propre** : beaucoup de parties, plusieurs saisons, K/D dans la norme.

## Fichiers

- `index.html` — structure de la page (formulaire + zone résultat).
- `styles.css` — mise en forme (thème sombre type R6).
- `script.js` — calcul des scores et affichage du résultat.
- `api/submissions.js` — route serverless : enregistrement via **Prisma**.
- `prisma/schema.prisma` — modèle `SuspectSubmission` ↔ table `suspect_submissions`.
- `lib/prisma.ts` — client Prisma pour Next.js ; `lib/node-prisma.js` — `getPrisma()` pour `api/submissions.js` (évite le conflit de nom avec `@/lib/prisma`).
- `db/schema.sql` — équivalent SQL à exécuter une fois sur Neon si tu n’utilises pas `db push`.
- `package.json` — scripts `db:*` et génération du client au `npm install`.
- `cours.txt` — ton cours web (HTML, CSS, Git).

## Sauvegarde PostgreSQL (optionnelle)

Après une analyse, un bloc **Save to database** permet d’envoyer les champs + scores à une API. Il faut :

1. Créer une base PostgreSQL (Neon, Supabase, Vercel Postgres, etc.).
2. Exécuter `db/schema.sql` sur cette base.
3. Définir la variable d’environnement **`DATABASE_URL`** là où l’API tourne (voir Vercel ci‑dessous).
4. Optionnel : **`SAVE_API_KEY`** — si elle est définie, l’API exige l’en-tête `x-save-key` avec la même valeur ; le champ mot de passe sous le bouton sert à ça.

## Prisma

- Après **`npm install`**, **`prisma generate`** tourne automatiquement (`postinstall`) : le client est prêt pour l’API et pour Vercel (`vercel-build` = `prisma generate`).
- **`npm run db:validate`** — vérifie le schéma (utilise `.env.example` pour une `DATABASE_URL` factice).
- **`npm run db:push`** — pousse le schéma vers la base pointée par **`.env.local`** (alternative à exécuter `db/schema.sql` à la main). Ne lance pas ça sur une base de prod sans réfléchir aux effets.
- **`npm run db:pull`** — met à jour `schema.prisma` depuis une base existante (introspection).

Tu n’as **rien à refaire** si la table existe déjà : l’insertion **Save to database** utilise le même nom de table et les mêmes colonnes.

## Vercel : compatibilité et déploiement

L’architecture actuelle est **compatible Vercel** :

- Les fichiers statiques à la racine (`index.html`, `styles.css`, `script.js`, `Tokyo Reggie.mp3`, etc.) sont servis tels quels.
- Le dossier `api/` devient des **Serverless Functions** (`/api/submissions`).

Étapes typiques :

1. Installer les deps : `npm install`
2. Lier le projet : `npx vercel` (ou import du dépôt Git dans le dashboard Vercel).
3. Dans **Project → Settings → Environment Variables**, ajouter `DATABASE_URL` (et éventuellement `SAVE_API_KEY`).
4. Redéployer.

En local, **`vercel dev`** démarre le même routage que en prod (statique + `/api/*`) et lit `.env.local` (copie `.env.example` → `.env.local`).

Ouvrir seulement `index.html` en `file://` ne permet pas d’appeler `/api/submissions` ; utilise `vercel dev` ou un déploiement.

## Lancer en local

**Sans base de données** — page statique seule :

```bash
python -m http.server 8000
# Puis http://localhost:8000
```

**Avec API + PostgreSQL** (recommandé si tu testes la sauvegarde) :

```bash
npm install
# Renseigne DATABASE_URL dans .env.local (voir commentaires dans le fichier)
npm run dev
# → http://localhost:3000 (page + /api/submissions sans installer Vercel CLI)
```

Alternative : `npx vercel dev` si tu préfères le même runtime que en production.

## Page Next.js (historique en base)

- **`app/page.tsx`** — Server Component : lit **`suspect_submissions`** avec Prisma et affiche un tableau (jusqu’à 200 lignes).
- **`npm run next:dev`** — lance Next sur **http://localhost:3001** (l’outil formulaire reste sur **`npm run dev`** → port **3000**).
- Next charge automatiquement **`.env.local`** pour **`DATABASE_URL`**.

Build production Next : **`npm run next:build`**.

---

*Stats à récupérer manuellement depuis le Tracker ; pas d’API officielle utilisée. Résultat à titre indicatif uniquement.*
