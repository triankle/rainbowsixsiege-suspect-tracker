/**
 * Vercel Serverless: GET /api/stats
 * Returns aggregate statistics over suspect_submissions.
 * Requires DATABASE_URL.
 */
const { getPrisma } = require('../lib/node-prisma.js');

function sendJson(res, statusCode, obj) {
  res.statusCode = statusCode;
  setSecurityHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const conn = process.env.DATABASE_URL;
  if (!conn || !String(conn).trim()) {
    return sendJson(res, 503, {
      error:
        'DATABASE_URL is empty. Paste your Postgres connection string into .env.local (local) or Vercel env (deployed).',
    });
  }

  try {
    const prisma = getPrisma();

    const total = await prisma.suspectSubmission.count();

    const agg = await prisma.$queryRaw`
      SELECT
        ROUND(AVG(kd)::numeric, 3) AS avg_kd,
        ROUND(AVG(winrate)::numeric, 1) AS avg_winrate,
        ROUND(AVG(cheat_score)::numeric, 1) AS avg_cheat,
        ROUND(AVG(smurf_score)::numeric, 1) AS avg_smurf,
        MAX(created_at) AS last_submission
      FROM suspect_submissions
    `;

    const rows = Array.isArray(agg) ? agg[0] : agg || {};

    const verdicts = await prisma.$queryRaw`
      SELECT verdict, COUNT(*) AS count
      FROM suspect_submissions
      GROUP BY verdict
      ORDER BY count DESC
    `;

    const safeVerdicts = (Array.isArray(verdicts) ? verdicts : []).map((v) => ({
      verdict: v.verdict,
      count: Number(v.count),
    }));

    return sendJson(res, 200, {
      ok: true,
      total,
      averages: {
        kd: rows.avg_kd != null ? Number(rows.avg_kd) : null,
        winrate: rows.avg_winrate != null ? Number(rows.avg_winrate) : null,
        cheatScore: rows.avg_cheat != null ? Number(rows.avg_cheat) : null,
        smurfScore: rows.avg_smurf != null ? Number(rows.avg_smurf) : null,
      },
      lastSubmission: rows.last_submission || null,
      verdicts: safeVerdicts,
    });
  } catch (err) {
    console.error('stats error', err.message);
    return sendJson(res, 500, { error: 'Database error' });
  }
};
