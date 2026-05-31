const { z } = require('zod');
const { ValidationError } = require('./api-response.js');

const nullableTrimmedString = (max) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) return null;
      const text = String(value).trim();
      if (!text) return null;
      return text.slice(0, max);
    });

const reasonsSchema = z
  .array(
    z
      .object({
        title: z.string().trim().max(120).optional(),
        text: z.string().trim().max(500).optional(),
        impact: z.union([z.string().trim().max(40), z.number()]).optional(),
      })
      .passthrough()
  )
  .max(30)
  .default([]);

const submissionSchema = z.object({
  pseudo: nullableTrimmedString(200),
  kd: z.coerce.number().finite().min(0).max(20),
  winrate: z
    .union([z.coerce.number().finite().min(0).max(100), z.literal(''), z.null(), z.undefined()])
    .transform((value) => (value === '' || value === null || value === undefined ? null : Number(value))),
  ranked: z.coerce.number().int().min(0).max(100000),
  level: z.coerce.number().int().min(0).max(10000),
  rankKey: nullableTrimmedString(32),
  playedSeasons: z
    .array(z.coerce.number().int().min(1).max(99))
    .min(1)
    .max(30)
    .transform((items) => Array.from(new Set(items)).sort((a, b) => a - b)),
  verdict: z.string().trim().min(1).max(32),
  verdictLabel: z.string().trim().min(1).max(200),
  cheatScore: z.coerce.number().finite().min(0).max(100),
  smurfScore: z.coerce.number().finite().min(0).max(100),
  reasons: reasonsSchema,
});

const entriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  pseudo: nullableTrimmedString(80),
});

const emptyQuerySchema = z.object({}).passthrough();

function formatZodError(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'request',
    code: issue.code,
    message: issue.message,
  }));
}

function parseOrThrow(schema, value) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError('Invalid request input', formatZodError(parsed.error));
  }
  return parsed.data;
}

function parseJsonBody(rawBody) {
  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody);
    } catch {
      throw new ValidationError('Invalid JSON body', [
        { field: 'body', code: 'invalid_json', message: 'Request body must be valid JSON.' },
      ]);
    }
  }
  if (rawBody && typeof rawBody === 'object') return rawBody;
  throw new ValidationError('Invalid JSON body', [
    { field: 'body', code: 'required', message: 'Request body is required.' },
  ]);
}

module.exports = {
  emptyQuerySchema,
  entriesQuerySchema,
  parseJsonBody,
  parseOrThrow,
  submissionSchema,
};
