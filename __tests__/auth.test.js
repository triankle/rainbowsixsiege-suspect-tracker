const {
  authenticateCredentials,
  createToken,
  hashPassword,
  verifyToken,
} = require('../lib/auth.js');
const { AuthenticationError, ValidationError } = require('../lib/api-response.js');

describe('auth helpers', () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    process.env.AUTH_USERNAME = 'admin';
    process.env.AUTH_PASSWORD_HASH = hashPassword('Demo1234!Demo');
    process.env.AUTH_JWT_SECRET = 'a-random-demo-secret-with-more-than-32-chars';
  });

  afterAll(() => {
    process.env = previousEnv;
  });

  test('authenticates valid credentials', () => {
    expect(authenticateCredentials('admin', 'Demo1234!Demo')).toEqual({
      username: 'admin',
      role: 'admin',
    });
  });

  test('rejects weak or missing password input', () => {
    expect(() => authenticateCredentials('admin', '')).toThrow(ValidationError);
  });

  test('detects tampered JWT signatures', () => {
    const token = createToken('admin');
    const tampered = token.replace(/\.[^.]+$/, '.invalid-signature');

    expect(() => verifyToken(tampered)).toThrow(AuthenticationError);
  });
});
