const {
  authenticateCredentials,
  createToken,
  TOKEN_TTL_SECONDS,
} = require('../../lib/auth.js');
const {
  handleApiError,
  requireMethod,
  sendEmpty,
  sendJson,
} = require('../../lib/api-response.js');
const { loginSchema, parseJsonBody, parseOrThrow } = require('../../lib/validation.js');

module.exports = async function handler(req, res) {
  try {
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
  } catch (err) {
    return handleApiError(res, err, 'auth login error');
  }
};
