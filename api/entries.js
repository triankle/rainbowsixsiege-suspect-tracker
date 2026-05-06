/**
 * Vercel Serverless: GET /api/entries
 * Returns the stored suspect submissions (paginated, newest first).
 * Requires DATABASE_URL. Optional READ_API_KEY (client sends x-read-key header).
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

function sendJson(res, statusCode, obj) {
  res.statusCode = statusCode;
  setSecurityHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function sendEmpty(res, statusCode) {
  res.statusCode = statusCode;
  setSecurityHeaders(res);
  res.end();
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-read-key');
    return sendEmpty(res, 204);
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const readSecret = process.env.READ_API_KEY;
  if (process.env.NODE_ENV === 'production' && !readSecret) {
    return sendJson(res, 503, {
      error: 'READ_API_KEY must be configured in production.',
    });
  }
  if (readSecret && String(readSecret).length > 0) {
    const sent = req.headers['x-read-key'];
    if (sent !== readSecret) {
      return sendJson(res, 401, { error: 'Invalid or missing read key' });
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

  try {
    const rawQuery = req.query && typeof req.query === 'object' ? req.query : {};
    const limitRaw = Number(rawQuery.limit);
    const offsetRaw = Number(rawQuery.offset);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(200, Math.max(1, Math.round(limitRaw)))
      : 50;
    const offset = Number.isFinite(offsetRaw)
      ? Math.max(0, Math.round(offsetRaw))
      : 0;
    const pseudo =
      typeof rawQuery.pseudo === 'string' && rawQuery.pseudo.trim()
        ? rawQuery.pseudo.trim().slice(0, 80)
        : null;

    const prisma = getPrisma();
    const where = pseudo
      ? { pseudo: { contains: pseudo, mode: 'insensitive' } }
      : undefined;
    const rows = await prisma.suspectSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
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
    return sendJson(res, 200, { ok: true, rows: safe, limit, offset });
  } catch (err) {
    console.error('entries list error', err.message);
    return sendJson(res, 500, { error: 'Database error' });
  }
};
