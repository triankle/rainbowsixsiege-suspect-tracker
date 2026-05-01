/**
 * Vercel Serverless: POST /api/submissions
 * Requires DATABASE_URL. Optional SAVE_API_KEY (client sends x-save-key header).
 */
const { getPrisma } = require('../lib/node-prisma.js');

function isPlaceholderDatabaseUrl(url) {
  const u = String(url);
  return (
    u.includes('user:password@host') ||
    u.endsWith('/dbname') ||
    u.includes('postgres://user:password@')
  );
}

function clampStr(s, max) {
  if (s == null || s === '') return null;
  const t = String(s).trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function sendJson(res, statusCode, obj) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function sendEmpty(res, statusCode) {
  res.statusCode = statusCode;
  res.end();
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, x-save-key'
    );
    return sendEmpty(res, 204);
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const saveSecret = process.env.SAVE_API_KEY;
  if (req.method === 'POST' && saveSecret && String(saveSecret).length > 0) {
    const sent = req.headers['x-save-key'];
    if (sent !== saveSecret) {
      return sendJson(res, 401, { error: 'Invalid or missing save key' });
    }
  }

  const conn = process.env.DATABASE_URL;
  if (!conn || !String(conn).trim()) {
    return sendJson(res, 503, {
      error:
        'DATABASE_URL is empty. Paste your Postgres connection string into .env.local (local) or Vercel env (deployed).',
    });
  }
  if (isPlaceholderDatabaseUrl(conn)) {
    return sendJson(res, 503, {
      error:
        'DATABASE_URL is still the example value. Replace it with the real URI from Neon / Supabase / etc.',
    });
  }

  if (req.method === 'GET') {
    try {
      const prisma = getPrisma();
      const rows = await prisma.suspectSubmission.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      const safe = rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        pseudo: r.pseudo,
        kd: r.kd != null ? Number(r.kd) : null,
        winrate: r.winrate != null ? Number(r.winrate) : null,
        rankedMatches: r.rankedMatches,
        accountLevel: r.accountLevel,
        rankKey: r.rankKey,
        seasonsPlayed: r.seasonsPlayed,
        verdict: r.verdict,
        verdictLabel: r.verdictLabel,
        cheatScore: r.cheatScore != null ? Number(r.cheatScore) : null,
        smurfScore: r.smurfScore != null ? Number(r.smurfScore) : null,
        reasonsJson: r.reasonsJson,
      }));
      return sendJson(res, 200, { ok: true, rows: safe });
    } catch (err) {
      console.error('submissions list error', err.message);
      return sendJson(res, 500, { error: 'Database error' });
    }
  }

  const raw =
    typeof req.body === 'string'
      ? safeJson(req.body)
      : req.body && typeof req.body === 'object'
        ? req.body
        : null;

  if (!raw) {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const kd = Number(raw.kd);
  const ranked = Number(raw.ranked);
  const level = Number(raw.level);
  const cheatScore = Number(raw.cheatScore);
  const smurfScore = Number(raw.smurfScore);

  if (
    !Number.isFinite(kd) ||
    !Number.isFinite(ranked) ||
    !Number.isFinite(level) ||
    !Number.isFinite(cheatScore) ||
    !Number.isFinite(smurfScore)
  ) {
    return sendJson(res, 400, { error: 'Invalid numeric fields' });
  }

  let playedSeasons = raw.playedSeasons;
  if (!Array.isArray(playedSeasons)) {
    return sendJson(res, 400, { error: 'playedSeasons must be an array' });
  }
  playedSeasons = playedSeasons
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
  if (playedSeasons.length === 0) {
    return sendJson(res, 400, { error: 'playedSeasons cannot be empty' });
  }

  const verdict = clampStr(raw.verdict, 32);
  const verdictLabel = clampStr(raw.verdictLabel, 200);
  if (!verdict || !verdictLabel) {
    return sendJson(res, 400, { error: 'verdict and verdictLabel required' });
  }

  let winrate = raw.winrate;
  if (winrate === '' || winrate === undefined || winrate === null) {
    winrate = null;
  } else {
    winrate = Number(winrate);
    if (!Number.isFinite(winrate)) winrate = null;
  }

  const rankKey = clampStr(raw.rankKey, 32);
  const pseudo = clampStr(raw.pseudo, 200);
  const reasons = Array.isArray(raw.reasons) ? raw.reasons : [];

  try {
    const prisma = getPrisma();
    const row = await prisma.suspectSubmission.create({
      data: {
        pseudo,
        kd,
        winrate,
        rankedMatches: Math.round(ranked),
        accountLevel: Math.round(level),
        rankKey,
        seasonsPlayed: playedSeasons,
        verdict,
        verdictLabel,
        cheatScore,
        smurfScore,
        reasonsJson: reasons,
      },
      select: { id: true, createdAt: true },
    });

    return sendJson(res, 201, {
      ok: true,
      id: row.id,
      created_at: row.createdAt,
    });
  } catch (err) {
    console.error('submissions insert error', err.message);
    return sendJson(res, 500, { error: 'Database error' });
  }
};

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
