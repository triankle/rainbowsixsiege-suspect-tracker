# Frontend documentation

## Structure actuelle

Le frontend principal est statique et situé dans `public/` :

```text
public/
  index.html        — formulaire principal
  entries.html      — historique PostgreSQL
  auth.html         — démonstration login JWT
  tokens.css        — design tokens
  styles.css        — styles globaux
  script.js         — orchestration UI et appel /api/v1/analyze
  scripts/
    api-client.js   — client API centralisé pour /api/v1
    report-utils.js — génération du rapport partageable
    dom-utils.js    — helpers DOM disponibles pour futures extractions
```

## Source de vérité métier

Le frontend ne contient plus le moteur heuristique. Au submit du formulaire, `public/script.js` appelle `window.R6Api.analyzeProfile()`, qui envoie les données à `POST /api/v1/analyze`.

La source de vérité est `lib/analyze.js` :

- utilisée par `POST /api/v1/analyze` pour l'affichage ;
- utilisée par `POST /api/v1/submissions` avant sauvegarde ;
- couverte par les tests unitaires Jest.

Ce choix évite une divergence entre le verdict affiché et le verdict réellement stocké.

## Design system minimal

Le fichier `public/tokens.css` centralise :

- Palette : `--color-primary`, `--color-success`, `--color-warning`, `--color-error`, neutres et surfaces.
- Typographie : échelle `--font-size-xs` à `--font-size-xl`.
- Espacements : échelle `--space-1` à `--space-8`.
- Radius : `--radius-sm`, `--radius-md`, `--radius-lg`.
- Shadows : `--shadow-sm`, `--shadow-md`, `--shadow-lg`.

`public/styles.css` consomme ces tokens via les variables historiques (`--ink`, `--panel`, `--accent`, etc.) afin de garder la compatibilité avec l'UI existante.

## Fonctions principales dans `script.js`

- `buildSeasonCheckboxes()` — génère les checkboxes de saisons.
- `readFormPayload()` — lit et valide les champs UI avant appel API.
- `displayResult()` — affiche le verdict, les scores et les raisons.
- `copyShareableReport()` — copie le rapport généré par `scripts/report-utils.js`.
- `submitSaveToDb()` — sauvegarde via `scripts/api-client.js`.

## Tests frontend

Playwright couvre le parcours principal :

```bash
npm run test:e2e
```

Le test démarre `scripts/local-dev.cjs`, ouvre `/`, remplit le formulaire, appelle le moteur serveur via `/api/v1/analyze`, puis vérifie l'affichage du résultat et les boutons de sauvegarde/copie.

## Améliorations possibles

- Extraire le JavaScript inline de `entries.html` vers `public/scripts/entries-page.js`.
- Ajouter une vue carte mobile pour l'historique.
- Harmoniser complètement la langue de l'interface.
- Ajouter davantage de tests E2E sur la sauvegarde, l'historique et l'authentification.
