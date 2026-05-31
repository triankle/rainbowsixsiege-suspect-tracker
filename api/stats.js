/**
 * Vercel Serverless: GET /api/stats
 * Returns aggregate statistics over suspect_submissions.
 */
const { getPrisma } = require('../lib/node-prisma.js');
const {
  handleApiError,
  requireDatabaseUrl,
  requireMethod,
  sendEmpty,
  sendJson,
} = require('../lib/api-response.js');
const { emptyQuerySchema, parseOrThrow } = require('../lib/validation.js');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return sendEmpty(res, 204);
    }

    requireMethod(req, ['GET']);
    parseOrThrow(emptyQuerySchema, req.query && typeof req.query === 'object' ? req.query : {});
    requireDatabaseUrl();

    const prisma = getPrisma();
    const total = await prisma.suspectSubmission.count();
    const agg = await prisma.suspectSubmission.aggregate({
      _avg: {
        kd: true,
        winrate: true,
        cheatScore: true,
        smurfScore: true,
      },
      _max: {
        createdAt: true,
      },
    });
    const verdicts = await prisma.suspectSubmission.groupBy({
      by: ['verdict'],
      _count: { verdict: true },
      orderBy: { _count: { verdict: 'desc' } },
    });
    const safeVerdicts = verdicts.map((v) => ({
      verdict: v.verdict,
      count: v._count.verdict,
    }));
    const payload = {
      total,
      averages: {
        kd: agg._avg.kd != null ? Number(agg._avg.kd) : null,
        winrate: agg._avg.winrate != null ? Number(agg._avg.winrate) : null,
        cheatScore: agg._avg.cheatScore != null ? Number(agg._avg.cheatScore) : null,
        smurfScore: agg._avg.smurfScore != null ? Number(agg._avg.smurfScore) : null,
      },
      lastSubmission: agg._max.createdAt || null,
      verdicts: safeVerdicts,
    };

    return sendJson(res, 200, {
      ok: true,
      data: payload,
      ...payload,
    });
  } catch (err) {
    return handleApiError(res, err, 'stats error');
  }
};
