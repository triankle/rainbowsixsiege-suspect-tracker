/**
 * Vercel Serverless: POST /api/submissions
 * Stores one analysed R6 profile in PostgreSQL.
 */
const { getPrisma } = require('../lib/node-prisma.js');
const {
  AuthenticationError,
  handleApiError,
  requireDatabaseUrl,
  requireMethod,
  sendEmpty,
  sendJson,
} = require('../lib/api-response.js');
const {
  parseJsonBody,
  parseOrThrow,
  submissionSchema,
} = require('../lib/validation.js');

module.exports = async function handler(req, res) {
  try {
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
  } catch (err) {
    return handleApiError(res, err, 'submissions insert error');
  }
};
