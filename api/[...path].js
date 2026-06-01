/**
 * Single Vercel Serverless Function for all API routes.
 * Keeping one file under api/ avoids the Hobby plan function-count limit.
 */
const { getPrisma } = require('../lib/node-prisma.js');
const {
  authenticateCredentials,
  createToken,
  requireBearerAuth,
  TOKEN_TTL_SECONDS,
} = require('../lib/auth.js');
const {
  AuthenticationError,
  handleApiError,
  requireDatabaseUrl,
  requireMethod,
  sendEmpty,
  sendJson,
} = require('../lib/api-response.js');
const {
  emptyQuerySchema,
  entriesQuerySchema,
  loginSchema,
  parseJsonBody,
  parseOrThrow,
  submissionSchema,
} = require('../lib/validation.js');

function getRoutePath(req) {
  const fromQuery = req.query && req.query.path;
  const pathFromCatchAll = Array.isArray(fromQuery)
    ? fromQuery.join('/')
    : typeof fromQuery === 'string'
      ? fromQuery
      : '';

  const pathname = pathFromCatchAll
    ? `/${pathFromCatchAll}`
    : new URL(req.url || '/', 'http://localhost').pathname.replace(/^\/api(?=\/|$)/, '');

  const withoutVersion = pathname.replace(/^\/v1(?=\/|$)/, '');
  return withoutVersion || '/';
}

function getQuery(req) {
  const query = req.query && typeof req.query === 'object' ? { ...req.query } : {};
  delete query.path;
  return query;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join('|') : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildEntriesWhere(query) {
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

async function handleSubmissions(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-save-key');
    return sendEmpty(res, 204);
  }

  requireMethod(req, ['POST']);

  const saveSecret = process.env.SAVE_API_KEY;
  if (process.env.NODE_ENV === 'production' && !saveSecret) {
    throw new AuthenticationError('SAVE_API_KEY must be configured in production.');
  }
  if (saveSecret && req.headers['x-save-key'] !== saveSecret) {
    throw new AuthenticationError('Invalid or missing save key');
  }

  requireDatabaseUrl();

  const input = parseOrThrow(submissionSchema, parseJsonBody(req.body));
  const prisma = getPrisma();
  const row = await prisma.suspectSubmission.create({
    data: {
      pseudo: input.pseudo,
      kd: input.kd,
      winrate: input.winrate,
      rankedMatches: input.ranked,
      accountLevel: input.level,
      rankKey: input.rankKey,
      seasonsPlayed: input.playedSeasons,
      verdict: input.verdict,
      verdictLabel: input.verdictLabel,
      cheatScore: input.cheatScore,
      smurfScore: input.smurfScore,
      reasonsJson: input.reasons,
    },
    select: { id: true, createdAt: true },
  });

  return sendJson(res, 201, {
    ok: true,
    data: {
      id: row.id,
      createdAt: row.createdAt,
    },
    id: row.id,
    created_at: row.createdAt,
  });
}

async function handleEntries(req, res) {
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

  const query = parseOrThrow(entriesQuerySchema, getQuery(req));
  const where = buildEntriesWhere(query);
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
}

async function handleStats(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return sendEmpty(res, 204);
  }

  requireMethod(req, ['GET']);
  parseOrThrow(emptyQuerySchema, getQuery(req));
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
}

async function handleExportCsv(req, res) {
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
  const query = parseOrThrow(entriesQuerySchema, getQuery(req));
  const [sortField, sortDirection] = query.sort.startsWith('-')
    ? [query.sort.slice(1), 'desc']
    : [query.sort, 'asc'];

  const rows = await getPrisma().suspectSubmission.findMany({
    where: buildEntriesWhere(query),
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
}

async function handleAuthLogin(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return sendEmpty(res, 204);
  }

  requireMethod(req, ['POST']);
  const input = parseOrThrow(loginSchema, parseJsonBody(req.body));
  const user = authenticateCredentials(input.username, input.password);
  const token = createToken(user.username);

  return sendJson(res, 200, {
    ok: true,
    data: {
      user,
      token,
      tokenType: 'Bearer',
      expiresIn: TOKEN_TTL_SECONDS,
    },
  });
}

async function handleAuthMe(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    return sendEmpty(res, 204);
  }

  requireMethod(req, ['GET']);
  const payload = requireBearerAuth(req);
  return sendJson(res, 200, {
    ok: true,
    data: {
      username: payload.sub,
      role: payload.role,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    },
  });
}

const routes = {
  '/submissions': handleSubmissions,
  '/entries': handleEntries,
  '/stats': handleStats,
  '/export.csv': handleExportCsv,
  '/auth/login': handleAuthLogin,
  '/auth/me': handleAuthMe,
};

module.exports = async function handler(req, res) {
  const routePath = getRoutePath(req);
  const routeHandler = routes[routePath];

  if (!routeHandler) {
    return sendJson(res, 404, {
      ok: false,
      error: 'Not found',
    });
  }

  try {
    return await routeHandler(req, res);
  } catch (err) {
    return handleApiError(res, err, `${routePath} error`);
  }
};
