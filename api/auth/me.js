const { requireBearerAuth } = require('../../lib/auth.js');
const {
  handleApiError,
  requireMethod,
  sendEmpty,
  sendJson,
} = require('../../lib/api-response.js');

module.exports = async function handler(req, res) {
  try {
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
  } catch (err) {
    return handleApiError(res, err, 'auth me error');
  }
};
