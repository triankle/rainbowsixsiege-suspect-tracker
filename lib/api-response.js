const isProd = process.env.NODE_ENV === 'production';

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message = 'Invalid request input', details) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict', details) {
    super(message, 409, 'CONFLICT', details);
  }
}

class ConfigurationError extends AppError {
  constructor(message) {
    super(message, 503, 'CONFIGURATION_ERROR');
  }
}

class InternalError extends AppError {
  constructor(message = 'Internal Server Error') {
    super(message, 500, 'INTERNAL_ERROR');
  }
}

function setSecurityHeaders(res) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  setSecurityHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function sendData(res, statusCode, data, meta) {
  return sendJson(res, statusCode, meta ? { data, meta } : { data });
}

function sendEmpty(res, statusCode) {
  res.statusCode = statusCode;
  setSecurityHeaders(res);
  res.end();
}

function handleApiError(res, err, logLabel = 'api error') {
  if (err instanceof AppError) {
    return sendJson(res, err.statusCode, {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  console.error(logLabel, err && err.stack ? err.stack : err);
  return sendJson(res, 500, {
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'Internal Server Error' : 'Database error',
    },
  });
}

function requireMethod(req, allowed) {
  if (!allowed.includes(req.method)) {
    throw new AppError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }
}

function isPlaceholderDatabaseUrl(url) {
  const u = String(url);
  return (
    u.includes('user:password@host') ||
    u.endsWith('/dbname') ||
    u.includes('postgres://user:password@')
  );
}

function requireDatabaseUrl() {
  const conn = process.env.DATABASE_URL;
  if (!conn || !String(conn).trim()) {
    throw new ConfigurationError(
      'DATABASE_URL is empty. Configure a PostgreSQL connection string in .env.local or Vercel Environment Variables.'
    );
  }
  if (isPlaceholderDatabaseUrl(conn)) {
    throw new ConfigurationError('DATABASE_URL is still the example value. Replace it with the real URI from Neon or another PostgreSQL provider.');
  }
}

module.exports = {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConfigurationError,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
  handleApiError,
  requireDatabaseUrl,
  requireMethod,
  sendData,
  sendEmpty,
  sendJson,
  setSecurityHeaders,
};
