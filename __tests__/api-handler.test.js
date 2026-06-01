const handler = require('../api/[...path].js');

function createResponse() {
  return {
    headers: {},
    statusCode: 0,
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value = '') {
      this.body = value;
    },
  };
}

describe('api handler security', () => {
  const previousEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  test('requires READ_API_KEY for stats in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.READ_API_KEY;
    const res = createResponse();

    await handler(
      {
        method: 'GET',
        url: '/api/v1/stats',
        headers: {},
        query: {},
      },
      res
    );

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe('AUTHENTICATION_ERROR');
  });

  test('returns normalized 404 errors', async () => {
    const res = createResponse();

    await handler(
      {
        method: 'GET',
        url: '/api/v1/unknown',
        headers: {},
        query: {},
      },
      res
    );

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe('NOT_FOUND');
  });
});
