# Frontend documentation

## Structure actuelle

Le frontend principal est statique et situé dans `public/` :

```text
public/
  index.html       — formulaire principal
  entries.html     — historique PostgreSQL
  tokens.css       — design tokens (couleurs, typo, spacing, radius, shadows)
  script.js        — logique d'analyse et UI (≈636 lignes)
  styles.css       — styles globaux (≈753 lignes)
  music_bg.mp3     — ambiance audio
```

## Design system minimal

Le fichier `public/tokens.css` centralise les décisions visuelles principales :

- Palette : `--color-primary`, `--color-success`, `--color-warning`, `--color-error`, neutres et surfaces.
- Typographie : échelle `--font-size-xs` à `--font-size-xl`.
- Espacements : échelle `--space-1` à `--space-8`, basée sur des multiples de 4/8 px.
- Radius : `--radius-sm`, `--radius-md`, `--radius-lg`.
- Shadows : `--shadow-sm`, `--shadow-md`, `--shadow-lg`.

`public/styles.css` consomme ces tokens via les variables historiques (`--ink`, `--panel`, `--accent`, etc.) afin de garder la compatibilité avec l'UI existante.

## Fonctions principales dans `script.js`

- `buildSeasonCheckboxes()` — génère les checkboxes de saisons.
- `getPlayedSeasons()` — lit les saisons cochées.
- `matchConfidence()` — calcule la confiance selon le volume de matchs.
- `kdBaseCheat()` — score de base cheat selon K/D.
- `rankKdCheatMultiplier()` — multiplicateur selon le rang.
- `rankKdSmurfBoost()` — boost smurf selon rang/K/D.
- `winrateCheatContribution()` — contribution win rate.
- `largestSeasonGap()` — plus grand écart entre saisons.
- `onlyCurrentSeasonPlayed()` — détecte si seule saison courante.
- `analyzeProfile()` — fonction principale d'analyse heuristique.
- `displayResult()` — affiche le verdict et les scores.
- `submitSaveToDb()` — POST vers `/api/submissions`.
- `buildShareableReport()` — génère le rapport texte.
- `copyShareableReport()` — copie dans le presse-papier.

## État actuel

Le frontend est fonctionnel mais monolithique. Pour améliorer la lisibilité et maintenabilité, une refactorisation vers une structure modulaire est possible :

```text
public/scripts/
  dom.js              — utilitaires DOM (escapeHtml, showFormError, etc.)
  analysis.js         — logique heuristique pure (déjà extraite dans lib/analyze.js)
  ui.js               — gestion de l'affichage
  api.js              — appels vers /api/submissions, /api/entries
  index.js            — point d'entrée qui orchestre les modules
```

Cependant, cette refactorisation n'est pas critique pour le MVP actuel : l'application fonctionne, les tests métier couvrent la logique d'analyse, et l'UI est stable.

## Améliorations possibles pour le futur

- Migrer vers React/Next.js pour une componentisation réelle.
- Ajouter un design system avec tokens CSS.
- Séparer les hooks de logique métier.
- Ajouter des tests E2E (Playwright) pour le parcours utilisateur.
