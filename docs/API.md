# Documentation API

Base production : `https://suspecttracker-rayanpotteratres-7933s-projects.vercel.app`

Toutes les routes sont servies par une seule fonction Vercel : `api/[...path].js`. La version stable est `/api/v1`.

## Format des réponses

Succès :

```json
{ "data": {}, "meta": {} }
```

Erreur :

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request input", "details": [] } }
```

Des champs historiques (`rows`, `id`, `created_at`) sont encore renvoyés sur certaines routes pour compatibilité frontend.

## Authentification et autorisation

Les utilisateurs applicatifs sont stockés dans PostgreSQL (`auth_users`) avec un hash `scrypt`, un rôle RBAC et une version de token. Le seed crée `admin`, `moderator` et `viewer` avec le mot de passe `Demo1234!Demo`.

| Mécanisme | Header | Routes |
| --- | --- | --- |
| JWT RBAC | `Authorization: Bearer <token>` | Routes protégées selon permission |
| `SAVE_API_KEY` legacy | `x-save-key` | `POST /api/v1/submissions` |
| `READ_API_KEY` legacy | `x-read-key` | `GET /api/v1/entries`, `GET /api/v1/export.csv`, `GET /api/v1/stats` |

Permissions :

| Rôle | Permissions |
| --- | --- |
| `admin` | analyse, création, lecture, stats, export, gestion utilisateurs |
| `moderator` | analyse, création, lecture, stats, export |
| `viewer` | analyse, lecture, stats, export |

Les clés API restent acceptées pour compatibilité avec l'UI statique. En production, une route protégée exige soit la clé legacy correcte, soit un JWT avec la permission demandée.

## Inventaire REST

| Méthode | Path | But | Auth requise | Réponse 2xx | Erreurs |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/v1/analyze` | Recalcule un verdict sans sauvegarder | Non | `200` | `400`, `405`, `500` |
| `POST` | `/api/v1/submissions` | Recalcule puis sauvegarde une analyse | `moderator+` ou `x-save-key` | `201` | `400`, `401`, `403`, `405`, `503`, `500` |
| `GET` | `/api/v1/entries` | Liste l'historique paginé | `viewer+` ou `x-read-key` | `200` | `400`, `401`, `403`, `405`, `503`, `500` |
| `GET` | `/api/v1/export.csv` | Exporte l'historique filtré | `viewer+` ou `x-read-key` | `200` | `400`, `401`, `403`, `405`, `503`, `500` |
| `GET` | `/api/v1/stats` | Retourne les agrégats | `viewer+` ou `x-read-key` | `200` | `400`, `401`, `403`, `405`, `503`, `500` |
| `POST` | `/api/v1/auth/login` | Génère un JWT RBAC | utilisateur DB actif | `200` | `400`, `401`, `405`, `503`, `500` |
| `GET` | `/api/v1/auth/me` | Vérifie le JWT courant | Bearer token | `200` | `401`, `405`, `503`, `500` |
| `POST` | `/api/v1/auth/logout` | Révoque le JWT courant | Bearer token | `200` | `401`, `405`, `503`, `500` |

## `POST /api/v1/analyze`

Calcule le verdict côté serveur sans écrire en base.

```bash
curl -X POST "$BASE_URL/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{"pseudo":"Triankle","kd":1.7,"winrate":71,"ranked":210,"level":120,"rankKey":"emerald","playedSeasons":[17,18]}'
```

```json
{
  "data": {
    "verdict": "suspect",
    "verdictLabel": "Possible cheater — stats warrant scrutiny (not proof)",
    "cheatScore": 62,
    "smurfScore": 20,
    "reasons": []
  }
}
```

## `POST /api/v1/submissions`

Sauvegarde une analyse. Le serveur ignore les scores/verdict client comme source de vérité et recalcule avec `lib/analyze.js`.

```bash
curl -X POST "$BASE_URL/api/v1/submissions" \
  -H "Content-Type: application/json" \
  -H "x-save-key: $SAVE_API_KEY" \
  -d '{"pseudo":"Triankle","kd":1.7,"winrate":71,"ranked":210,"level":120,"rankKey":"emerald","playedSeasons":[17,18],"verdict":"uncertain","verdictLabel":"client value","cheatScore":0,"smurfScore":0,"reasons":[]}'
```

```json
{
  "data": {
    "id": "uuid",
    "createdAt": "2026-06-01T12:00:00.000Z",
    "analysis": {
      "verdict": "suspect",
      "cheatScore": 62,
      "smurfScore": 20
    }
  },
  "meta": { "sourceOfTruth": "server" }
}
```

## `GET /api/v1/entries`

Query params stricts :

| Paramètre | Type | Défaut | Usage |
| --- | --- | --- | --- |
| `limit` | integer `1..200` | `50` | Taille de page |
| `offset` | integer `0..100000` | `0` | Décalage |
| `pseudo` | string | `null` | Filtre pseudo insensible à la casse |
| `verdict` | `clean`, `smurf`, `suspect`, `uncertain` | `null` | Filtre verdict |
| `rank` | string | `null` | Filtre rang |
| `minScore` | number `0..100` | `null` | Score minimum cheat ou smurf |
| `sort` | enum | `-createdAt` | `createdAt`, `cheatScore`, `smurfScore`, avec `-` pour desc |

```bash
curl "$BASE_URL/api/v1/entries?limit=20&verdict=suspect&sort=-cheatScore" \
  -H "x-read-key: $READ_API_KEY"
```

## `GET /api/v1/export.csv`

Utilise les mêmes filtres que `/entries`.

```bash
curl "$BASE_URL/api/v1/export.csv?minScore=70" \
  -H "x-read-key: $READ_API_KEY" \
  -o r6-suspect-entries.csv
```

## `GET /api/v1/stats`

Retourne les agrégats protégés par `READ_API_KEY` en production.

```bash
curl "$BASE_URL/api/v1/stats" -H "x-read-key: $READ_API_KEY"
```

```json
{
  "data": {
    "total": 5,
    "averages": {
      "kd": 1.72,
      "winrate": 61.4,
      "cheatScore": 48,
      "smurfScore": 36
    },
    "lastSubmission": "2026-06-01T12:00:00.000Z",
    "verdicts": [
      { "verdict": "suspect", "count": 2 }
    ]
  }
}
```

## Auth admin

Créer les utilisateurs de démonstration :

```bash
npm run seed
```

Login :

```bash
curl -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Demo1234!Demo"}'
```

Vérification :

```bash
curl "$BASE_URL/api/v1/auth/me" -H "Authorization: Bearer $TOKEN"
```

Logout serveur :

```bash
curl -X POST "$BASE_URL/api/v1/auth/logout" -H "Authorization: Bearer $TOKEN"
```

Le logout incrémente `tokenVersion` en base. Les anciens JWT deviennent invalides même si leur signature est encore correcte.
