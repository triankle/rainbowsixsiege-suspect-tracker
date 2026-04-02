# R6 Suspect Check

Petit site web pour estimer si un profil Rainbow Six Siege est **suspect (triche)** ou **type smurf**, à partir des stats qu’on peut voir sur [R6 Tracker](https://r6.tracker.network/r6siege/profile/ubi/).

## Utilisation

1. Ouvre le profil du joueur sur **r6.tracker.network**.
2. Ouvre `index.html` dans ton navigateur (double-clic ou serveur local).
3. Renseigne les champs avec les stats du profil (K/D, parties, classé, niveau, saisons, rang).
4. Clique sur **Analyser le profil** pour voir le verdict et les explications.

## Critères utilisés

- **Suspicion triche** : K/D très élevé avec peu de parties, win rate très haut avec peu de jeux.
- **Smurf** : rang élevé avec niveau compte bas, peu de parties pour le rang, peu de saisons jouées.
- **Profil propre** : beaucoup de parties, plusieurs saisons, K/D dans la norme.

## Fichiers

- `index.html` — structure de la page (formulaire + zone résultat).
- `styles.css` — mise en forme (thème sombre type R6).
- `script.js` — calcul des scores et affichage du résultat.
- `cours.txt` — ton cours web (HTML, CSS, Git).

## Lancer en local

Tu peux ouvrir directement `index.html` dans le navigateur. Pour éviter des soucis de CORS si tu ajoutes des requêtes plus tard, tu peux lancer un serveur minimal :

```bash
# Python 3
python -m http.server 8000
# Puis ouvre http://localhost:8000
```

---

*Stats à récupérer manuellement depuis le Tracker ; pas d’API officielle utilisée. Résultat à titre indicatif uniquement.*
