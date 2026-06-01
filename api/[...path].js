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
  NotFoundError,
  requireDatabaseUrl,
  requireMethod,
  sendEmpty,
  sendJson,
  setSecurityHeaders,
} = require('../lib/api-response.js');
const {
  analysisInputSchema,
  emptyQuerySchema,
  entriesQuerySchema,
  loginSchema,
  parseJsonBody,
  parseOrThrow,
  submissionSchema,
} = require('../lib/validation.js');
const { createSubmissionService } = require('../lib/services/submission-service.js');

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
  const { row, analysis } = await createSubmissionService(getPrisma()).createSubmission(input);

  return sendJson(res, 201, {
    data: {
      id: row.id,
      createdAt: row.createdAt,
      analysis,
    },
    meta: {
      sourceOfTruth: 'server',
    },
    id: row.id,
    created_at: row.createdAt,
  });
}

async function handleAnalyze(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return sendEmpty(res, 204);
  }

  requireMethod(req, ['POST']);
  const input = parseOrThrow(analysisInputSchema, parseJsonBody(req.body));
  const analysis = createSubmissionService(getPrisma()).analyzeSubmission(input);
  return sendJson(res, 200, { data: analysis });
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
  const { rows, total } = await createSubmissionService(getPrisma()).listEntries(query);

  return sendJson(res, 200, {
    data: rows,
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
    rows,
    limit: query.limit,
    offset: query.offset,
  });
}

async function handleStats(req, res) {
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
  parseOrThrow(emptyQuerySchema, getQuery(req));
  requireDatabaseUrl();

  const payload = await createSubmissionService(getPrisma()).getStats();

  return sendJson(res, 200, {
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
  const rows = await createSubmissionService(getPrisma()).getExportRows(query);

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
  setSecurityHeaders(res);
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
    data: {
      username: payload.sub,
      role: payload.role,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    },
  });
}

const routes = {
  '/analyze': handleAnalyze,
  '/submissions': handleSubmissions,
  '/entries': handleEntries,
  '/stats': handleStats,
  '/export.csv': handleExportCsv,
  '/auth/login': handleAuthLogin,
  '/auth/me': handleAuthMe,
};

module.exports = async function handler(req, res) {
  try {
    const routePath = getRoutePath(req);
    const routeHandler = routes[routePath];

    if (!routeHandler) {
      throw new NotFoundError(`Route ${routePath} not found`);
    }

    return await routeHandler(req, res);
  } catch (err) {
    return handleApiError(res, err, 'api route error');
  }
};
