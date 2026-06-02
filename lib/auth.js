const crypto = require('crypto');
const {
  AuthenticationError,
  AuthorizationError,
  ConfigurationError,
  ValidationError,
} = require('./api-response.js');

const TOKEN_TTL_SECONDS = 15 * 60;

const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  VIEWER: 'viewer',
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    'analysis:run',
    'submissions:create',
    'entries:read',
    'stats:read',
    'export:read',
    'users:manage',
  ],
  [ROLES.MODERATOR]: [
    'analysis:run',
    'submissions:create',
    'entries:read',
    'stats:read',
    'export:read',
  ],
  [ROLES.VIEWER]: ['analysis:run', 'entries:read', 'stats:read', 'export:read'],
};

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function roleForPrisma(role) {
  return String(role || '').toUpperCase();
}

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

function verifyApiKey(provided, expected) {
  if (!expected || !provided) return false;
  return timingSafeEqualText(provided, expected);
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

function requireJwtSecret() {
  const jwtSecret = process.env.AUTH_JWT_SECRET;
  if (!jwtSecret) {
    throw new ConfigurationError('AUTH_JWT_SECRET must be configured.');
  }
  if (String(jwtSecret).length < 32) {
    throw new ConfigurationError('AUTH_JWT_SECRET must be at least 32 characters long.');
  }
  return jwtSecret;
}

function createToken(user) {
  const jwtSecret = requireJwtSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    username: user.username,
    role: normalizeRole(user.role),
    tokenVersion: user.tokenVersion || 0,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  return `${unsigned}.${sign(unsigned, jwtSecret)}`;
}

function verifyToken(token) {
  const jwtSecret = requireJwtSecret();
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new AuthenticationError('Invalid token');

  const [encodedHeader, encodedPayload, signature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = sign(unsigned, jwtSecret);
  if (!timingSafeEqualText(signature, expected)) {
    throw new AuthenticationError('Invalid token signature');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new AuthenticationError('Invalid token payload');
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new AuthenticationError('Token expired');
  }
  if (!payload.sub || !payload.username || !payload.role) {
    throw new AuthenticationError('Invalid token claims');
  }

  return payload;
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  const match = /^Bearer\s+(.+)$/i.exec(String(header || ''));
  return match ? match[1] : null;
}

async function authenticateCredentials(prisma, usernameOrEmail, password) {
  const login = String(usernameOrEmail || '').trim().toLowerCase();
  if (!login || !password) {
    throw new ValidationError('Username/email and password are required');
  }

  const user = await prisma.authUser.findFirst({
    where: {
      OR: [{ username: login }, { email: login }],
    },
  });

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    throw new AuthenticationError('Invalid username/email or password');
  }

  await prisma.authUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: normalizeRole(user.role),
    tokenVersion: user.tokenVersion,
  };
}

async function requireBearerAuth(req, prisma) {
  const token = getBearerToken(req);
  if (!token) throw new AuthenticationError('Bearer token required');

  const payload = verifyToken(token);
  const user = await prisma.authUser.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw new AuthenticationError('User is inactive or no longer exists');
  }
  if ((user.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
    throw new AuthenticationError('Token has been revoked');
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: normalizeRole(user.role),
    tokenVersion: user.tokenVersion,
    exp: payload.exp,
  };
}

function hasPermission(user, permission) {
  return (ROLE_PERMISSIONS[user.role] || []).includes(permission);
}

async function requirePermission(req, prisma, permission) {
  const user = await requireBearerAuth(req, prisma);
  if (!hasPermission(user, permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }
  return user;
}

async function revokeCurrentUserTokens(req, prisma) {
  const user = await requireBearerAuth(req, prisma);
  await prisma.authUser.update({
    where: { id: user.id },
    data: { tokenVersion: { increment: 1 } },
  });
  return user;
}

module.exports = {
  ROLE_PERMISSIONS,
  ROLES,
  TOKEN_TTL_SECONDS,
  authenticateCredentials,
  createToken,
  hashPassword,
  hasPermission,
  normalizeRole,
  requireBearerAuth,
  requirePermission,
  revokeCurrentUserTokens,
  roleForPrisma,
  verifyApiKey,
  verifyToken,
};
