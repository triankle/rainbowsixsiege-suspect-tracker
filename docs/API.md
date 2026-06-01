# Documentation API

Base URL production : `https://suspecttracker-rayanpotteratres-7933s-projects.vercel.app`

Version stable recommandée : `/api/v1`. Les anciennes routes `/api/*` restent disponibles comme alias de compatibilité.

Toutes les réponses JSON récentes utilisent le format principal `{ data, meta? }` ou `{ error }`. Certains champs historiques (`ok`, `rows`, `id`) sont conservés pour compatibilité avec le frontend existant.

## Authentification

L'application n'a pas de comptes utilisateurs. Les routes sensibles sont protégées par clés serveur injectées via variables d'environnement Vercel.

| Clé | Header client | Usage |
| --- | --- | --- |
| `SAVE_API_KEY` | `x-save-key` | Autorise l'écriture d'une analyse. |
| `READ_API_KEY` | `x-read-key` | Autorise la lecture de l'historique. |
| `AUTH_USERNAME` + `AUTH_PASSWORD_HASH` + `AUTH_JWT_SECRET` | `Authorization: Bearer <token>` | Authentification admin JWT de démonstration. |

## `POST /api/v1/auth/login`

Authentifie l'administrateur configuré par variables d'environnement.

```json
{
  "username": "admin",
  "password": "Demo1234!Demo"
}
```

Réponse :

```json
{
  "data": {
    "user": { "username": "admin", "role": "admin" },
    "token": "jwt",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

## `GET /api/v1/auth/me`

Vérifie un JWT admin.

```bash
curl https://suspecttracker-rayanpotteratres-7933s-projects.vercel.app/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

## `POST /api/v1/submissions`

Enregistre une analyse dans PostgreSQL.

| Élément | Valeur |
| --- | --- |
| Méthode | `POST` |
| Auth | `x-save-key` si `SAVE_API_KEY` est configurée ; obligatoire en production |
| Content-Type | `application/json` |
| Succès | `201 Created` |

### Body

```json
{
  "pseudo": "Triankle",
  "kd": 1.7,
  "winrate": 71,
  "ranked": 210,
  "level": 120,
  "rankKey": "emerald",
  "playedSeasons": [17, 18],
  "verdict": "uncertain",
  "verdictLabel": "Mixed signals",
  "cheatScore": 30,
  "smurfScore": 0,
  "reasons": [
    { "text": "K/D is high for the rank." }
  ]
}
```

### Réponse succès

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "createdAt": "2026-05-31T20:00:00.000Z"
  },
  "id": "uuid",
  "created_at": "2026-05-31T20:00:00.000Z"
}
```

### Erreurs possibles

| Code | Cause |
| --- | --- |
| `400` | Body JSON invalide ou champ hors limites. |
| `401` | Clé `x-save-key` absente ou incorrecte. |
| `405` | Méthode non autorisée. |
| `503` | `DATABASE_URL` ou `SAVE_API_KEY` manquant en production. |
| `500` | Erreur interne masquée en production. |

### Exemple curl

```bash
curl -X POST https://suspecttracker-rayanpotteratres-7933s-projects.vercel.app/api/v1/submissions \
  -H "Content-Type: application/json" \
  -H "x-save-key: $SAVE_API_KEY" \
  -d '{"pseudo":"Triankle","kd":1.7,"winrate":71,"ranked":210,"level":120,"rankKey":"emerald","playedSeasons":[17,18],"verdict":"uncertain","verdictLabel":"Mixed signals","cheatScore":30,"smurfScore":0,"reasons":[]}'
```

## `GET /api/v1/entries`

Retourne l'historique paginé des analyses.

| Élément | Valeur |
| --- | --- |
| Méthode | `GET` |
| Auth | `x-read-key` si `READ_API_KEY` est configurée ; obligatoire en production |
| Succès | `200 OK` |

### Query params

| Paramètre | Type | Défaut | Limites | Usage |
| --- | --- | --- | --- | --- |
| `limit` | integer | `50` | `1..200` | Nombre de lignes. |
| `offset` | integer | `0` | `0..100000` | Décalage de pagination. |
| `pseudo` | string | `null` | 80 caractères | Filtre insensible à la casse. |
| `verdict` | string | `null` | 32 caractères | Filtre par verdict. |
| `rank` | string | `null` | 32 caractères | Filtre par rang courant. |
| `minScore` | number | `null` | `0..100` | Score minimum sur l'axe cheat ou smurf. |
| `sort` | enum | `-createdAt` | champs autorisés | Tri par date, cheatScore ou smurfScore. |

### Réponse succès

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "createdAt": "2026-05-31T20:00:00.000Z",
      "pseudo": "Triankle",
      "kd": 1.7,
      "winrate": 71,
      "rankedMatches": 210,
      "accountLevel": 120,
      "rankKey": "emerald",
      "seasonsPlayed": [17, 18],
      "verdict": "uncertain",
      "verdictLabel": "Mixed signals",
      "cheatScore": 30,
      "smurfScore": 0,
      "reasonsJson": []
    }
  ],
  "meta": {
    "limit": 50,
    "offset": 0,
    "total": 1,
    "pseudo": null
  }
}
```

### Exemple curl

```bash
curl "https://suspecttracker-rayanpotteratres-7933s-projects.vercel.app/api/v1/entries?limit=20&offset=0&pseudo=tri" \
  -H "x-read-key: $READ_API_KEY"
```

## `GET /api/v1/export.csv`

Exporte l'historique filtré au format CSV avec les mêmes query params que `/api/v1/entries`.

```bash
curl "https://suspecttracker-rayanpotteratres-7933s-projects.vercel.app/api/v1/export.csv?verdict=suspect&minScore=70" \
  -H "x-read-key: $READ_API_KEY" \
  -o r6-suspect-entries.csv
```

## `GET /api/v1/stats`

Retourne des agrégats sur les analyses sauvegardées.

| Élément | Valeur |
| --- | --- |
| Méthode | `GET` |
| Auth | Aucune clé dédiée actuellement |
| Succès | `200 OK` |

### Réponse succès

```json
{
  "ok": true,
  "data": {
    "total": 4,
    "averages": {
      "kd": 1.72,
      "winrate": 73.25,
      "cheatScore": 58,
      "smurfScore": 24
    },
    "lastSubmission": "2026-05-31T20:00:00.000Z",
    "verdicts": [
      { "verdict": "suspect", "count": 3 },
      { "verdict": "uncertain", "count": 1 }
    ]
  }
}
```

### Exemple curl

```bash
curl https://suspecttracker-rayanpotteratres-7933s-projects.vercel.app/api/v1/stats
```

## Format d'erreur normalisé

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request input",
    "details": [
      { "field": "kd", "code": "too_small", "message": "Too small: expected number to be >=0" }
    ]
  }
}
```
