const { getPrisma } = require('../lib/node-prisma.js');
const {
  AuthenticationError,
  handleApiError,
  requireDatabaseUrl,
  requireMethod,
  sendEmpty,
} = require('../lib/api-response.js');
const { entriesQuerySchema, parseOrThrow } = require('../lib/validation.js');

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join('|') : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildWhere(query) {
  return {
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
}

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
    const query = parseOrThrow(entriesQuerySchema, req.query && typeof req.query === 'object' ? req.query : {});
    const [sortField, sortDirection] = query.sort.startsWith('-')
      ? [query.sort.slice(1), 'desc']
      : [query.sort, 'asc'];

    const rows = await getPrisma().suspectSubmission.findMany({
      where: buildWhere(query),
      orderBy: { [sortField]: sortDirection },
      take: Math.min(query.limit, 200),
      skip: query.offset,
    });

    const header = [
      'createdAt',
      'pseudo',
      'kd',
      'winrate',
      'rankedMatches',
      'accountLevel',
      'rankKey',
      'seasonsPlayed',
      'verdict',
      'verdictLabel',
      'cheatScore',
      'smurfScore',
    ];
    const lines = [header.join(',')].concat(
      rows.map((row) =>
        [
          row.createdAt.toISOString(),
          row.pseudo,
          row.kd,
          row.winrate,
          row.rankedMatches,
          row.accountLevel,
          row.rankKey,
          row.seasonsPlayed,
          row.verdict,
          row.verdictLabel,
          row.cheatScore,
          row.smurfScore,
        ]
          .map(csvEscape)
          .join(',')
      )
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="r6-suspect-entries.csv"');
    res.end(lines.join('\n'));
  } catch (err) {
    return handleApiError(res, err, 'export csv error');
  }
};
