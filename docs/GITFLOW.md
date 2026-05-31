# Workflow Git Flow

Ce projet utilise un Git Flow simplifié pour séparer production, intégration et chantiers.

## Branches

| Branche | Rôle | Règle |
| --- | --- | --- |
| `main` | Production Vercel | Toujours déployable, merge uniquement par PR. |
| `dev` | Intégration | Regroupe les features validées, merge uniquement par PR. |
| `feature/<nom>` | Chantier fonctionnel | Créée depuis `dev`, mergée vers `dev`. |
| `fix/<nom>` | Correctif ciblé | Créée depuis `dev`, mergée vers `dev`. |
| `hotfix/<nom>` | Correctif production urgent | Créée depuis `main`, mergée vers `main` puis `dev`. |

## Cycle de travail

```bash
git checkout dev
git pull --rebase
git checkout -b feature/nom-court
```

Après développement :

```bash
npm run check
git add -p
git commit -m "feat(scope): décrit le changement"
git push -u origin feature/nom-court
```

Puis ouvrir une Pull Request vers `dev`.

## Déploiement

1. PR `feature/*` vers `dev`.
2. CI verte.
3. Merge dans `dev`.
4. PR `dev` vers `main`.
5. CI verte.
6. Merge dans `main`.
7. Vercel déclenche le déploiement production.

## Branch protection à activer sur GitHub

Dans `Settings > Branches`, créer une règle pour `main` et une règle pour `dev` :

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require conversation resolution before merging.
- Block force pushes.
- Restrict deletions.

Mettre ensuite `dev` comme default branch dans `Settings > General > Default branch`.

## Conventional Commits

Types recommandés :

- `feat`
- `fix`
- `docs`
- `test`
- `ci`
- `refactor`
- `chore`
- `style`
- `perf`

Exemples :

```text
feat(api): add zod validation
fix(frontend): restore root checker route
docs(readme): document deployment workflow
```
