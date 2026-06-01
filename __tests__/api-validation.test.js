const {
  entriesQuerySchema,
  loginSchema,
  parseJsonBody,
  parseOrThrow,
  submissionSchema,
} = require('../lib/validation.js');
const { ValidationError } = require('../lib/api-response.js');

describe('api validation', () => {
  const validSubmission = {
    pseudo: ' Triankle ',
    kd: 1.7,
    winrate: 71,
    ranked: 210,
    level: 120,
    rankKey: 'emerald',
    playedSeasons: [18, 17, 18],
    verdict: 'uncertain',
    verdictLabel: 'Mixed signals',
    cheatScore: 30,
    smurfScore: 0,
    reasons: [{ text: 'High K/D for rank.' }],
  };

  test('accepts and sanitizes a valid submission body', () => {
    const parsed = parseOrThrow(submissionSchema, validSubmission);

    expect(parsed.pseudo).toBe('Triankle');
    expect(parsed.playedSeasons).toEqual([17, 18]);
    expect(parsed.winrate).toBe(71);
  });

  test('rejects invalid submission numbers', () => {
    expect(() =>
      parseOrThrow(submissionSchema, {
        ...validSubmission,
        kd: -1,
      })
    ).toThrow(ValidationError);
  });

  test('rejects submissions without played seasons', () => {
    expect(() =>
      parseOrThrow(submissionSchema, {
        ...validSubmission,
        playedSeasons: [],
      })
    ).toThrow(ValidationError);
  });

  test('accepts default entries query params', () => {
    const parsed = parseOrThrow(entriesQuerySchema, {});

    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(0);
    expect(parsed.pseudo).toBeNull();
  });

  test('rejects entries query limit above max', () => {
    expect(() => parseOrThrow(entriesQuerySchema, { limit: '999' })).toThrow(ValidationError);
  });

  test('accepts advanced entries query params', () => {
    const parsed = parseOrThrow(entriesQuerySchema, {
      pseudo: 'tri',
      verdict: 'suspect',
      minScore: '70',
      sort: '-cheatScore',
    });

    expect(parsed.verdict).toBe('suspect');
    expect(parsed.minScore).toBe(70);
    expect(parsed.sort).toBe('-cheatScore');
  });

  test('rejects weak login password length', () => {
    expect(() =>
      parseOrThrow(loginSchema, {
        username: 'admin',
        password: 'short',
      })
    ).toThrow(ValidationError);
  });

  test('parses JSON body strings', () => {
    expect(parseJsonBody('{"ok":true}')).toEqual({ ok: true });
  });

  test('rejects invalid JSON body strings', () => {
    expect(() => parseJsonBody('{bad')).toThrow(ValidationError);
  });
});
