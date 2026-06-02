const {
  authenticateCredentials,
  createToken,
  hashPassword,
  requirePermission,
  revokeCurrentUserTokens,
  verifyToken,
} = require('../lib/auth.js');
const {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} = require('../lib/api-response.js');

function createMockPrisma(user) {
  return {
    authUser: {
      findFirst: jest.fn().mockResolvedValue(user),
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue(user),
    },
  };
}

describe('auth helpers', () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = 'a-random-demo-secret-with-more-than-32-chars';
  });

  afterAll(() => {
    process.env = previousEnv;
  });

  test('authenticates active database users', async () => {
    const user = {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      email: 'admin@demo.local',
      passwordHash: hashPassword('Demo1234!Demo'),
      role: 'ADMIN',
      isActive: true,
      tokenVersion: 0,
    };

    const authenticated = await authenticateCredentials(
      createMockPrisma(user),
      'admin',
      'Demo1234!Demo'
    );

    expect(authenticated).toMatchObject({
      id: user.id,
      username: 'admin',
      role: 'admin',
    });
  });

  test('rejects missing password input', async () => {
    await expect(
      authenticateCredentials(createMockPrisma(null), 'admin', '')
    ).rejects.toThrow(ValidationError);
  });

  test('detects tampered JWT signatures', () => {
    const token = createToken({
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      role: 'admin',
      tokenVersion: 0,
    });
    const tampered = token.replace(/\.[^.]+$/, '.invalid-signature');

    expect(() => verifyToken(tampered)).toThrow(AuthenticationError);
  });

  test('rejects users without required permissions', async () => {
    const viewer = {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'viewer',
      email: 'viewer@demo.local',
      passwordHash: hashPassword('Demo1234!Demo'),
      role: 'VIEWER',
      isActive: true,
      tokenVersion: 0,
    };
    const token = createToken(viewer);

    await expect(
      requirePermission(
        { headers: { authorization: `Bearer ${token}` } },
        createMockPrisma(viewer),
        'submissions:create'
      )
    ).rejects.toThrow(AuthorizationError);
  });

  test('revokes current user tokens by incrementing tokenVersion', async () => {
    const user = {
      id: '00000000-0000-0000-0000-000000000003',
      username: 'moderator',
      email: 'moderator@demo.local',
      passwordHash: hashPassword('Demo1234!Demo'),
      role: 'MODERATOR',
      isActive: true,
      tokenVersion: 0,
    };
    const prisma = createMockPrisma(user);
    const token = createToken(user);

    await revokeCurrentUserTokens(
      { headers: { authorization: `Bearer ${token}` } },
      prisma
    );

    expect(prisma.authUser.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
  });
});
