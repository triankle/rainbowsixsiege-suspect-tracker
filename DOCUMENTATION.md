# R6 Suspect Check — Documentation technique (soutenance)

> Site web qui aide à juger un profil **Rainbow Six Siege** (joueur potentiellement *cheater* ou *smurf*) à partir de stats ranked saisies à la main depuis [r6.tracker.network](https://r6.tracker.network/r6siege/profile/ubi/).
> Les analyses peuvent être **sauvegardées en PostgreSQL** via une route serverless, et **relues** depuis la même page d'accueil.

---

## 1. Vue d'ensemble

### 1.1 Objectif
Outil web léger qui :
1. Récupère manuellement les stats ranked d'un joueur (K/D, win rate, niveau, saisons jouées…).
2. Applique des **heuristiques** pondérées pour produire deux scores (axe *cheat* / axe *smurf*) et un verdict (`legit`, `smurf`, `possible cheater`, `mixed`).
3. Optionnellement, **persiste** chaque analyse en base de données pour garder un historique.
4. Permet de **consulter** cet historique depuis la même page (bouton en bas).

### 1.2 Pourquoi cette stack ?

| Choix | Justification |
|-------|---------------|
| **HTML/CSS/JS statique** pour l'UI | Page mono-fichier, pas de framework lourd, ouvrable sans build → simple à présenter. |
| **Serverless Vercel** pour l'API | Déploiement gratuit, pas de serveur à maintenir, scaling automatique. |
| **PostgreSQL (Neon)** pour la base | Postgres managé, free tier, branché en quelques secondes. |
| **Prisma** comme ORM | Schéma typé, génération automatique du client, requêtes lisibles, multi-runtime (Node + Next.js). |
| **Next.js (App Router)** en option | Server Component qui lit la table en SSR — alternative à la consultation depuis `index.html`. |

---

## 2. Architecture

### 2.1 Schéma global

```
┌────────────────────────────────────────────────────────────────────┐
│                       Navigateur (utilisateur)                      │
│                                                                    │
│  index.html  ──►  styles.css                                        │
│       │                                                            │
│       └──►  script.js                                               │
│              ├── Heuristiques (analyzeProfile)                      │
│              ├── POST /api/submissions  ──── Save to database       │
│              └── GET  /api/submissions  ──── Show stored entries    │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│        Vercel  (statique + Serverless Functions)                   │
│                                                                    │
│   /                       →  index.html, styles.css, script.js …   │
│   /api/submissions        →  api/submissions.js  (Node serverless) │
│                                  │                                 │
│                                  ▼                                 │
│                            Prisma Client                           │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │ TLS, libpq
                                   ▼
┌────────────────────────────────────────────────────────────────────┐
│          PostgreSQL (Neon / Supabase / Vercel Postgres)            │
│                                                                    │
│          Table : suspect_submissions                               │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Flux d'une analyse

```
[1] L'utilisateur remplit le formulaire (KD, WR, ranked, niveau, saisons, rang)
        │
        ▼
[2] script.js → analyzeProfile(input)
    ├─ matchConfidence(ranked)               (low / medium / high)
    ├─ kdBaseCheat(kd) × rankKdCheatMultiplier(rankStep)
    ├─ rankKdSmurfBoost(kd, rankStep)
    ├─ winrateCheatContribution(winrate)
    ├─ pondérations niveau de compte / saisons / gaps de saisons
    └─ scaling final selon la confiance
        │
        ▼
[3] Affichage du verdict + score 0–100 + raisons détaillées
        │
        ▼
[4] (Optionnel) Clic sur « Save to database »
        │
        ▼
[5] POST /api/submissions  →  Prisma  →  INSERT INTO suspect_submissions …
        │
        ▼
[6] (Optionnel) Clic sur « Show stored entries » en bas de page
        │
        ▼
[7] GET /api/submissions   →  Prisma  →  SELECT … ORDER BY created_at DESC LIMIT 200
        │
        ▼
[8] Rendu en tableau dans la même page
```

---

## 3. Structure du dépôt

```
rainbowsixsiege-suspect-tracker/
│
├── index.html              ← Page d'accueil (formulaire + résultat + viewer BDD)
├── styles.css              ← Thème editorial-noir (Paradise Hotel like)
├── script.js               ← Heuristiques + DOM + appels API (POST/GET)
├── music_bg.mp3            ← Ambiance sonore (toggle UI)
│
├── api/
│   └── submissions.js      ← Serverless Function : POST (insert) + GET (list)
│
├── lib/
│   ├── prisma.ts           ← Client Prisma pour Next.js (lib/prisma)
│   └── node-prisma.js      ← Client Prisma pour les fonctions Node (api/*.js)
│
├── prisma/
│   ├── schema.prisma       ← Source du schéma : modèle SuspectSubmission
│   └── db.ts               ← Réexport pour code TS
│
├── db/
│   └── schema.sql          ← Équivalent SQL pur (alternative à `prisma db push`)
│
├── app/                    ← App Next.js (alternative au viewer in-page)
│   ├── layout.tsx
│   ├── page.tsx            ← Server Component : lecture de la table
│   └── globals.css
│
├── scripts/
│   └── local-dev.cjs       ← Mini-serveur Node : sert le statique + /api/*
│
├── .env.example            ← Modèle de variables d'environnement
├── .env.local              ← (non versionné) DATABASE_URL réelle
├── package.json            ← Scripts npm (dev, db:*, next:*)
├── prisma → .next → .vercel  (dossiers générés)
└── README.md / DOCUMENTATION.md
```

---

## 4. Front-end (page statique)

### 4.1 `index.html`
Trois sections principales dans `<main>` :

1. **`.intro`** — explication du fonctionnement (rappels Ubisoft : ranked à partir du niveau 50).
2. **`.form-section`** — formulaire avec :
   - Pseudo (optionnel)
   - K/D ranked, Win rate %, Ranked matches, Niveau, Saisons (cases dynamiques générées par JS), Rang.
3. **`#result-section`** — verdict + scores + raisons + bloc « Save to database ».
4. **`#db-section`** — viewer BDD avec les boutons **Show stored entries / Refresh / Hide** et la table des sauvegardes.

### 4.2 `styles.css`
Thème **editorial-noir** :
- Palette : `--ink` `#070708`, `--accent` `#e22c2c` (rouge), monospace `IBM Plex Mono`, display `Syne`.
- Atmosphère : grain SVG animé, scanlines, vignette radiale (effet ciné).
- Composants : verdicts colorés (`suspect`, `smurf`, `clean`, `uncertain`), barres de score, tables responsive.

### 4.3 `script.js` — l'algorithme

**Constantes pivots :**
```js
const CURRENT_SEASON_NUM = 18;     // saison ranked actuelle (à incrémenter)
const MIN_LEVEL_FOR_RANKED = 50;   // ranked verrouillé en dessous (Ubisoft)
const SMURF_GAP_SEASONS = 4;       // gap ≥ 4 saisons sautées → smurf signal
```

**Pipeline d'`analyzeProfile()` :**

| Étape | Fonction(s) | Effet |
|-------|-------------|-------|
| 1. Confiance | `matchConfidence(ranked)` | low (<100) / medium (100–300) / high (>300) → multiplicateurs finaux |
| 2. K/D base | `kdBaseCheat(kd)` | poids cheat brut selon la tranche K/D |
| 3. Contexte rang | `rankKdCheatMultiplier(rankStep)` | × 0.78 → × 1.22 selon Cu/Br/…/Ch |
| 4. Smurf signal | `rankKdSmurfBoost(kd, rankStep)` | bonus si bons stats en lobby bas |
| 5. Win rate | `winrateCheatContribution(winrate)` | tranches ≤55%, ≤60%, ≤65%, ≤75%, > |
| 6. Niveau | rules `level<80`, `level<120`, `level>150` | smurf vs « main crédible » |
| 7. Saisons | `largestSeasonGap`, `onlyCurrentSeasonPlayed` | gaps + nb saisons → smurf prior |
| 8. Cohérence | rules « >300 matches + KD ≥1.8 » etc. | renforce / atténue |
| 9. Scaling | `cheatRaw *= conf.cheatMult` | applique la confiance |
| 10. Classification | seuils sur cheat/smurf | `legit / smurf / possible cheater / mixed` |

**Sortie** : `{ verdict, verdictLabel, cheatScore, smurfScore, finalScore, confidence, classification, reasons[] }`.

> ⚠️ Heuristique uniquement, **pas une preuve** de triche — c'est l'avertissement affiché sur la page.

### 4.4 Bloc « Save to database »
- Apparaît dans `#result-content` après chaque analyse.
- Contient un input `password` (clé optionnelle `SAVE_API_KEY`) et le bouton.
- Envoie un `POST /api/submissions` avec `Content-Type: application/json` et l'en-tête `x-save-key` si une clé est saisie.

### 4.5 Bloc « Show stored entries » (viewer in-page)
- Bouton en bas de page (`#db-load-btn`).
- Au clic → `fetch('/api/submissions')` (GET).
- Rendu d'un tableau (date, pseudo, KD, WR, ranked, niveau, rang, saisons, verdict, scores, aperçu des raisons).
- Boutons **Refresh** et **Hide** pour relancer ou masquer.

---

## 5. API — `api/submissions.js`

C'est une **Vercel Serverless Function** Node (CommonJS) qui répond sur `/api/submissions`.

### 5.1 Méthodes

| Méthode | Rôle | Auth |
|---------|------|------|
| `OPTIONS` | Preflight CORS | — |
| `POST`    | Insère une analyse | `x-save-key` requis si `SAVE_API_KEY` défini |
| `GET`     | Liste les 200 dernières analyses | Public (lecture seule) |
| `*`       | `405 Method Not Allowed` | — |

### 5.2 Validation côté serveur
- `DATABASE_URL` non vide et non placeholder.
- Champs numériques convertis et vérifiés (`Number.isFinite`).
- `playedSeasons` doit être un tableau d'entiers non vide.
- `verdict` et `verdictLabel` requis (truncation `clampStr`).
- `reasons` : tableau JSON arbitraire stocké tel quel dans `reasons_json`.

### 5.3 Réponses standardisées
```js
sendJson(res, 201, { ok: true, id, created_at });           // POST OK
sendJson(res, 200, { ok: true, rows: [...] });              // GET  OK
sendJson(res, 400, { error: 'Invalid …' });                 // payload KO
sendJson(res, 401, { error: 'Invalid or missing save key' });
sendJson(res, 503, { error: 'DATABASE_URL is empty …' });   // BDD non configurée
sendJson(res, 500, { error: 'Database error' });
```

---

## 6. Base de données

### 6.1 Schéma physique (`db/schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS suspect_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  pseudo          TEXT,
  kd              NUMERIC(8, 3) NOT NULL,
  winrate         NUMERIC(6, 2),
  ranked_matches  INTEGER NOT NULL,
  account_level   INTEGER NOT NULL,
  rank_key        TEXT,
  seasons_played  INTEGER[]   NOT NULL,
  verdict         TEXT NOT NULL,
  verdict_label   TEXT NOT NULL,
  cheat_score     NUMERIC(6, 2) NOT NULL,
  smurf_score     NUMERIC(6, 2) NOT NULL,
  reasons_json    JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS suspect_submissions_created_at_idx
  ON suspect_submissions (created_at DESC);
```

### 6.2 Modèle Prisma (`prisma/schema.prisma`)
```prisma
model SuspectSubmission {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  pseudo         String?
  kd             Decimal  @db.Decimal(8, 3)
  winrate        Decimal? @db.Decimal(6, 2)
  rankedMatches  Int      @map("ranked_matches")
  accountLevel   Int      @map("account_level")
  rankKey        String?  @map("rank_key")
  seasonsPlayed  Int[]    @map("seasons_played")
  verdict        String
  verdictLabel   String   @map("verdict_label")
  cheatScore     Decimal  @map("cheat_score") @db.Decimal(6, 2)
  smurfScore     Decimal  @map("smurf_score") @db.Decimal(6, 2)
  reasonsJson    Json     @default("[]") @map("reasons_json")

  @@map("suspect_submissions")
}
```

> **Pourquoi deux représentations (SQL + Prisma) ?**
> - Le `.sql` permet d'initialiser la base **sans Prisma** (utile pour Neon / pgAdmin).
> - Le `schema.prisma` est la source pour générer le **client typé** côté Node/Next.

---

## 7. Prisma — comment ça marche

### 7.1 Pourquoi Prisma ?
Prisma fournit :
- Un **client typé** auto-généré depuis le `schema.prisma` (autocomplétion, validation des champs).
- Une abstraction lisible (`prisma.suspectSubmission.create({ data: { … } })`) sans écrire de SQL.
- Une migration synchronisée (`db push` / `db pull`).
- Un singleton compatible serverless (évite la sur-création de connexions sur Vercel).

### 7.2 Deux clients distincts (et pourquoi)
| Fichier | Pour qui ? | Pourquoi pas l'autre ? |
|---------|------------|------------------------|
| `lib/prisma.ts`     | Next.js (`app/page.tsx`) | TS, import via alias `@/lib/prisma`. |
| `lib/node-prisma.js` | `api/submissions.js` (CommonJS) | **Évite que `@/lib/prisma` résolve sur le `.js`** dans Next, ce qui casserait la propriété `suspectSubmission` (camelCase typée par Prisma). |

Les deux exposent un **singleton** stocké sur `globalThis` pour ne pas ouvrir plusieurs pools Postgres en serverless.

### 7.3 Cycle de vie

```bash
# Source de vérité : prisma/schema.prisma

npx prisma generate     # ► node_modules/.prisma/client (client typé)
npx prisma db push      # ► applique le modèle vers la BDD pointée par DATABASE_URL
npx prisma db pull      # ◄ introspecte la BDD existante et met à jour schema.prisma
npx prisma validate     # vérifie la syntaxe et la cohérence
```

Hooks définis dans `package.json` :
- `postinstall` → `prisma generate` (le client est prêt après chaque `npm install`).
- `vercel-build` → `prisma generate` (le build Vercel régénère le client avant `next build` si besoin).

### 7.4 Variables d'environnement utilisées par Prisma
Une seule (lue automatiquement depuis `.env.local` en local et depuis Vercel Env en prod) :
```
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
```

---

## 8. Vercel — déploiement

### 8.1 Pourquoi Vercel ?
- **Hébergement statique gratuit** + **Serverless Functions** dans le même projet.
- Convention : tout fichier dans `api/*.js` devient une route `/api/*` (zero config).
- HTTPS automatique, déploiement par push Git, prévisualisations par PR.

### 8.2 Structure compatible
```
/                       → fichiers statiques (index.html, styles.css, script.js, …)
/api/submissions        → api/submissions.js (Node serverless, runtime auto)
/_next                  → (uniquement si on déploie Next.js en parallèle)
```

### 8.3 Procédure
```bash
# 1. Lier le projet
npx vercel              # ou import du dépôt depuis le dashboard

# 2. Variables d'environnement (Project → Settings → Environment Variables)
DATABASE_URL=postgres://...   # OBLIGATOIRE
SAVE_API_KEY=xxxxxx           # OPTIONNEL (sécurise l'écriture)

# 3. Déployer
git push                # ► déclenche un build automatique
# ou
npx vercel --prod
```

### 8.4 Build hooks
- `vercel-build` (défini dans `package.json`) → `prisma generate`.
  Vercel exécute ce script avant la construction des fonctions ; le client Prisma est packagé avec la fonction serverless.

### 8.5 Limites Vercel à connaître pour la soutenance
- Les fonctions sont **stateless** : pas de cache mémoire entre requêtes.
- Le **cold start** ouvre une connexion Postgres → c'est pour ça qu'on utilise un **singleton** + un Postgres compatible serverless (Neon, qui supporte le pooling).
- Quota free tier : 100 GB-heures de fonction, suffisant pour ce projet.

---

## 9. Lancer le projet en local

### 9.1 Prérequis
- Node ≥ 18
- Une `DATABASE_URL` PostgreSQL (Neon gratuit conseillé)

### 9.2 Première installation
```bash
git clone <repo>
cd rainbowsixsiege-suspect-tracker
npm install                       # ► postinstall: prisma generate

cp .env.example .env.local
# Éditer .env.local et y mettre la vraie DATABASE_URL
```

### 9.3 Initialiser la base
Au choix :
```bash
npm run db:push                   # via Prisma
# OU exécuter db/schema.sql sur la base (psql, pgAdmin, console Neon…)
```

### 9.4 Lancer le serveur
```bash
npm run dev
# ► Mini serveur Node :
#   - sert index.html, styles.css, script.js, music_bg.mp3
#   - route /api/submissions vers api/submissions.js
# ► http://localhost:3000
```

Alternative officielle Vercel :
```bash
npx vercel dev                    # même routing qu'en prod
```

Variante sans BDD (juste pour montrer l'analyse côté client) :
```bash
python -m http.server 8000
# ► http://localhost:8000  (les boutons Save/Show afficheront une erreur réseau)
```

### 9.5 Page Next.js (alternative à la consultation in-page)
```bash
npm run next:dev                  # ► http://localhost:3001
# affiche app/page.tsx : tableau SSR depuis Prisma
```

### 9.6 Scripts npm récap
| Script | Rôle |
|--------|------|
| `npm run dev`        | Serveur statique + API sur port 3000 (recommandé) |
| `npm run next:dev`   | Next.js sur port 3001 (page historique en SSR) |
| `npm run next:build` | Build de production Next |
| `npm run db:generate`| Régénère le client Prisma |
| `npm run db:push`    | Pousse `schema.prisma` vers la BDD |
| `npm run db:pull`    | Introspecte la BDD vers `schema.prisma` |
| `npm run db:validate`| Vérifie le schéma |

---

## 10. Sécurité

| Risque | Mesure |
|--------|--------|
| Injection SQL | Prisma paramètre toutes les requêtes → impossible. |
| XSS dans les raisons / pseudo | `escapeHtml()` côté `script.js` avant injection DOM. |
| Spam de l'endpoint POST | Variable `SAVE_API_KEY` + en-tête `x-save-key`. |
| Lecture sensible | GET ne retourne pas de données privées (pas de tokens, pas d'IP, pas de mot de passe stocké). |
| Secrets versionnés | `.env.local` est dans `.gitignore`. |
| CORS | Preflight `OPTIONS` autorisé pour `Content-Type, x-save-key`. |
| Validation des entrées | Numériques, longueurs, types — côté API. |

> Pour aller plus loin (axes d'amélioration cités en soutenance) :
> - Rate limiting (par IP ou par clé).
> - Captcha sur le formulaire.
> - Lecture protégée par une seconde clé (`READ_API_KEY`).
> - Pagination du GET (offset + limit).

---

## 11. Limites connues / pistes d'évolution

- **Pas d'API officielle Ubisoft** → l'utilisateur recopie les stats à la main.
- L'algorithme est **heuristique**, pas un classifieur ML — un score 80/100 ne *prouve* rien.
- `CURRENT_SEASON_NUM` doit être **incrémenté manuellement** à chaque nouvelle saison ranked.
- Le viewer BDD est **non paginé** (200 lignes max) — suffisant pour la démo, à paginer en prod.
- Pas de filtres / tri dans le tableau (axe d'amélioration : sort côté client, recherche par pseudo).
- Pas de tests automatisés — on pourrait ajouter Vitest/Jest sur les fonctions pures de `script.js`.

---

## 12. Plan de démo soutenance (10 min)

1. **Intro (1 min)** — montrer la page, expliquer le contexte (R6 ranked, problème de cheat/smurf).
2. **Démo formulaire (2 min)** — saisir un profil clean, puis un profil suspect, montrer les deux verdicts.
3. **Sous le capot du JS (1 min)** — ouvrir `script.js`, montrer `analyzeProfile()` et la composition des scores.
4. **Sauvegarde BDD (2 min)** — cliquer « Save to database », ouvrir la console Neon pour voir la ligne, puis revenir sur la page et cliquer « Show stored entries ».
5. **Architecture (2 min)** — schéma de l'archi (Vercel statique + serverless + Postgres + Prisma).
6. **Prisma + Vercel (1 min)** — montrer `schema.prisma`, expliquer pourquoi deux clients (`lib/prisma.ts` + `lib/node-prisma.js`).
7. **Conclusion (1 min)** — limites + pistes d'évolution + questions.

---

## 13. Antisèche : questions probables

> *« Pourquoi pas un backend Express ? »*
> Pour un usage faible et burst-y, le serverless est moins cher à opérer, ne demande pas de serveur dédié, et la séparation `static + api/*.js` est native chez Vercel.

> *« Pourquoi Prisma plutôt que `pg` brut ? »*
> Schéma déclaratif, client typé, migrations gérées (`db push`/`db pull`), code lisible. On ne réécrit pas du SQL pour un CRUD simple.

> *« Comment vous évitez de leak `DATABASE_URL` ? »*
> `.env.local` dans `.gitignore`, `.env.example` versionné avec une URL placeholder, secrets stockés dans Vercel Env (chiffrés au repos).

> *« Pourquoi deux clients Prisma ? »*
> Next.js (App Router) résout `@/lib/prisma` en regardant d'abord les `.js` puis les `.ts`. Si on appelle `lib/prisma.js`, Next prend le `.js` au lieu du `.ts` typé → la propriété `suspectSubmission` peut sauter. On nomme donc le fichier Node `node-prisma.js`.

> *« Le score 80/100 = cheater à 80 % ? »*
> Non. C'est une **suspicion** dérivée de poids définis à la main. La page le précise : *« indicative only — not evidence »*.

> *« Comment vous testeriez en prod si la BDD est down ? »*
> Le handler renvoie `503` avec un message explicite. Côté UI, `db-feedback--err` affiche le message tel quel à l'utilisateur.

> *« Quel est le coût de l'app ? »*
> Free tier Vercel + Free tier Neon → 0 € jusqu'à un trafic non-trivial. À l'échelle, la facturation est proportionnelle aux invocations serverless et au stockage Postgres.
