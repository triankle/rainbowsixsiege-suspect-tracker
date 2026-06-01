const crypto = require('crypto');
const { AuthenticationError, ConfigurationError, ValidationError } = require('./api-response.js');

const TOKEN_TTL_SECONDS = 15 * 60;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('base64url')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('base64url');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, salt, expected] = String(storedHash || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = hashPassword(password, salt).split('$')[2];
  return timingSafeEqualText(actual, expected);
}

function requireAuthConfig() {
  const username = process.env.AUTH_USERNAME;
  const passwordHash = process.env.AUTH_PASSWORD_HASH;
  const jwtSecret = process.env.AUTH_JWT_SECRET;

  if (!username || !passwordHash || !jwtSecret) {
    throw new ConfigurationError('AUTH_USERNAME, AUTH_PASSWORD_HASH and AUTH_JWT_SECRET must be configured.');
  }
  if (String(jwtSecret).length < 32) {
    throw new ConfigurationError('AUTH_JWT_SECRET must be at least 32 characters long.');
  }

  return { username, passwordHash, jwtSecret };
}

function createToken(subject) {
  const { jwtSecret } = requireAuthConfig();
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: subject,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  return `${unsigned}.${sign(unsigned, jwtSecret)}`;
}

function verifyToken(token) {
  const { jwtSecret } = requireAuthConfig();
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new AuthenticationError('Invalid token');

  const [encodedHeader, encodedPayload, signature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = sign(unsigned, jwtSecret);
  if (!timingSafeEqualText(signature, expected)) throw new AuthenticationError('Invalid token signature');

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new AuthenticationError('Invalid token payload');
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new AuthenticationError('Token expired');
  }

  return payload;
}

function requireBearerAuth(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  const match = /^Bearer\s+(.+)$/i.exec(String(header || ''));
  if (!match) throw new AuthenticationError('Bearer token required');
  return verifyToken(match[1]);
}

function authenticateCredentials(username, password) {
  const config = requireAuthConfig();
  if (!username || !password) throw new ValidationError('Username and password are required');
  if (!timingSafeEqualText(username, config.username) || !verifyPassword(password, config.passwordHash)) {
    throw new AuthenticationError('Invalid username or password');
  }
  return { username: config.username, role: 'admin' };
}

module.exports = {
  TOKEN_TTL_SECONDS,
  authenticateCredentials,
  createToken,
  hashPassword,
  requireBearerAuth,
  verifyToken,
};
