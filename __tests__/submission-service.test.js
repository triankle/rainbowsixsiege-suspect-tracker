const {
  analyzeSubmission,
  createSubmissionService,
  toCreateData,
} = require('../lib/services/submission-service.js');

describe('submission service', () => {
  const input = {
    pseudo: 'Forged.Client',
    kd: 2.4,
    winrate: 79,
    ranked: 80,
    level: 70,
    rankKey: 'emerald',
    playedSeasons: [18],
    verdict: 'clean',
    verdictLabel: 'Client tried to lie',
    cheatScore: 0,
    smurfScore: 0,
    reasons: [],
  };

  test('recomputes verdict and scores instead of trusting client fields', () => {
    const data = toCreateData(input);

    expect(data.verdict).not.toBe(input.verdict);
    expect(data.cheatScore).toBeGreaterThan(input.cheatScore);
    expect(data.reasonsJson.length).toBeGreaterThan(0);
  });

  test('returns deterministic analysis for the same submission input', () => {
    expect(analyzeSubmission(input)).toEqual(analyzeSubmission(input));
  });

  test('creates a submission through the repository boundary', async () => {
    const create = jest.fn().mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const service = createSubmissionService({
      suspectSubmission: {
        create,
      },
    });

    const result = await service.createSubmission(input);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verdict: result.analysis.verdict,
          cheatScore: result.analysis.cheatScore,
        }),
      })
    );
    expect(result.row.id).toBe('00000000-0000-0000-0000-000000000001');
  });
});
