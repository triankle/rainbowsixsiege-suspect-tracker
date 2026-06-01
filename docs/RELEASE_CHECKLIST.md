# Checklist release et soutenance

## Objectif

Cette checklist sert à prouver le workflow Git Flow, le déploiement public, les captures d'écran et les contrôles finaux avant la soutenance.

## 1. Pull Requests obligatoires

1. Ouvrir une PR `feature/max-xp-polish` vers `dev`.
2. Attendre que GitHub Actions soit verte.
3. Merger la PR dans `dev`.
4. Ouvrir une PR `dev` vers `main`.
5. Attendre que GitHub Actions soit verte.
6. Merger dans `main` pour déclencher le déploiement production Vercel.

## 2. Branch protection GitHub

Dans `Settings > Branches`, créer une règle pour `main` et une règle pour `dev` avec :

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require conversation resolution before merging.
- Block force pushes.
- Restrict deletions.

Pour `main`, activer aussi `Require linear history` si disponible.

## 3. Captures d'écran

Créer ces fichiers avant la soutenance :

- `docs/screenshots/home.png` — page d'accueil avec formulaire.
- `docs/screenshots/result.png` — résultat après analyse d'un profil.
- `docs/screenshots/entries.png` — page historique avec données chargées.

Puis vérifier que le README affiche bien les images ou les référence clairement.

## 4. Validation déploiement

Sur l'URL Vercel de production :

1. Ouvrir `/`.
2. Remplir un profil et lancer l'analyse.
3. Copier le rapport avec `Copy report`.
4. Sauvegarder avec `SAVE_API_KEY` si la clé est configurée.
5. Ouvrir `/entries` et charger les lignes avec `READ_API_KEY` si configurée.
6. Ouvrir `/api/v1/stats`.

## 5. Sécurité

1. Lancer `npm run check` localement.
2. Vérifier que Gitleaks passe dans GitHub Actions.
3. Tester une entrée pseudo contenant `<script>alert(1)</script>` : le texte doit être échappé et ne jamais s'exécuter.
4. Tester une entrée pseudo contenant `' OR 1=1--` : l'API doit répondre proprement, sans fuite SQL.
5. Vérifier les headers sur l'URL prod avec <https://securityheaders.com/>.

## 6. Domaine custom optionnel mais fortement recommandé

1. Demander un sous-domaine gratuit via `is-a.dev` ou `js.org`.
2. Ajouter le domaine dans Vercel.
3. Configurer les DNS demandés par Vercel.
4. Vérifier HTTPS et redirection HTTP vers HTTPS.
5. Ajouter l'URL custom dans le README.
