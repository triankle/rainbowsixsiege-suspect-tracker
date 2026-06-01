/**
 * Vercel Serverless: GET /api/entries
 * Returns stored suspect submissions with validated pagination and filtering.
 */
const { getPrisma } = require('../lib/node-prisma.js');
const {
  AuthenticationError,
  handleApiError,
  requireDatabaseUrl,
  requireMethod,
  sendEmpty,
  sendJson,
} = require('../lib/api-response.js');
const { entriesQuerySchema, parseOrThrow } = require('../lib/validation.js');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-read-key');
      return sendEmpty(res, 204);
    }

    requireMethod(req, ['GET']);

    const readSecret = process.env.READ_API_KEY;
    if (process.env.NODE_ENV === 'production' && !readSecret) {
      throw new AuthenticationError('READ_API_KEY must be configured in production.');
    }
    if (readSecret && req.headers['x-read-key'] !== readSecret) {
      throw new AuthenticationError('Invalid or missing read key');
    }

    requireDatabaseUrl();

    const query = parseOrThrow(
      entriesQuerySchema,
      req.query && typeof req.query === 'object' ? req.query : {}
    );
    const where = {
      ...(query.pseudo ? { pseudo: { contains: query.pseudo, mode: 'insensitive' } } : {}),
      ...(query.verdict ? { verdict: query.verdict } : {}),
      ...(query.rank ? { rankKey: query.rank } : {}),
      ...(query.minScore != null
        ? {
            OR: [
              { cheatScore: { gte: query.minScore } },
              { smurfScore: { gte: query.minScore } },
            ],
          }
        : {}),
    };
    const [sortField, sortDirection] = query.sort.startsWith('-')
      ? [query.sort.slice(1), 'desc']
      : [query.sort, 'asc'];

    const prisma = getPrisma();
    const [rows, total] = await Promise.all([
      prisma.suspectSubmission.findMany({
        where,
        orderBy: { [sortField]: sortDirection },
        skip: query.offset,
        take: query.limit,
      }),
      prisma.suspectSubmission.count({ where }),
    ]);

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

    return sendJson(res, 200, {
      ok: true,
      data: safe,
      meta: {
        limit: query.limit,
        offset: query.offset,
        total,
        pseudo: query.pseudo,
        verdict: query.verdict,
        rank: query.rank,
        minScore: query.minScore,
        sort: query.sort,
      },
      rows: safe,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (err) {
    return handleApiError(res, err, 'entries list error');
  }
};
