# Roadmap XP et Git Flow

Cette roadmap sert de file d'execution pour viser les paliers max sans casser le deploiement.

## Regle de branche

- `main` reste la production.
- `dev` sert d'integration.
- Un critere = une branche courte depuis `dev`, par exemple `feature/readme-specs` ou `feature/api-errors`.
- Un correctif urgent de production part de `main` avec `hotfix/<nom>`.
- Aucune PR ne doit recreer plusieurs fichiers `api/*.js` : l'API Vercel reste regroupee dans `api/[...path].js` pour respecter le plan Hobby.

## Ordre recommande

1. `7.3` et `6.3` : Git Flow, CI, PR template, hooks, branch protection.
2. `6.1` : deploiement public, variables Vercel, compte de demo, URL dans le README.
3. `1.1`, `1.2`, `7.2` : specifications, architecture et README final.
4. `3.1`, `3.2`, `3.3`, `3.4`, `4.2` : API, services, repositories, validation et erreurs.
5. `5.1`, `5.2`, `5.3`, `5.4` : authentification, autorisation, OWASP et secrets.
6. `4.1`, `4.3` : schema DB, migrations et seed realiste.
7. `2.1`, `2.2`, `2.3` : structure frontend, parcours complet et UX.
8. `8.1`, `8.2` : fonctionnalite non triviale et originalite visible.

## Checklist par PR

Avant de coder :

1. `git switch dev`
2. `git pull --rebase origin dev`
3. `git switch -c feature/<critere-court>`

Avant d'ouvrir la PR :

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run vercel-build`

La PR cible toujours `dev`, sauf hotfix urgent. Quand `dev` est stable, ouvrir une PR `dev` vers `main` pour declencher la production.

## Reglages GitHub a activer

Dans GitHub, creer une protection pour `main` et `dev` :

- Require a pull request before merging.
- Require status checks to pass.
- Require conversation resolution.
- Restrict deletions.
- Block force pushes.
- Optionnel sur `main` : require linear history.

Mettre aussi `dev` comme branche par defaut tant que le projet est en phase de developpement.
