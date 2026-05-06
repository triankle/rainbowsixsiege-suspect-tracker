const {
  matchConfidence,
  kdBaseCheat,
  rankKdCheatMultiplier,
  rankKdSmurfBoost,
  winrateCheatContribution,
  largestSeasonGap,
  onlyCurrentSeasonPlayed,
  analyzeProfile,
} = require('../lib/analyze.js');

describe('matchConfidence', () => {
  test('returns low for <100 matches', () => {
    const c = matchConfidence(50);
    expect(c.label).toBe('low');
    expect(c.cheatMult).toBeLessThan(1);
    expect(c.smurfMult).toBeGreaterThan(1);
  });
  test('returns medium for 100–300 matches', () => {
    const c = matchConfidence(200);
    expect(c.label).toBe('medium');
    expect(c.cheatMult).toBe(1);
    expect(c.smurfMult).toBe(1);
  });
  test('returns high for >300 matches', () => {
    const c = matchConfidence(400);
    expect(c.label).toBe('high');
    expect(c.cheatMult).toBeGreaterThan(1);
    expect(c.smurfMult).toBeLessThan(1);
  });
});

describe('kdBaseCheat', () => {
  test('returns 0 for kd < 1.0', () => {
    expect(kdBaseCheat(0.8)).toBe(0);
  });
  test('returns 10 for 1.0–1.4', () => {
    expect(kdBaseCheat(1.2)).toBe(10);
  });
  test('returns 34 for 1.4–1.8', () => {
    expect(kdBaseCheat(1.6)).toBe(34);
  });
  test('returns 58 for 1.8–2.2', () => {
    expect(kdBaseCheat(2.0)).toBe(58);
  });
  test('returns 84 for kd >= 2.2', () => {
    expect(kdBaseCheat(2.5)).toBe(84);
  });
});

describe('rankKdCheatMultiplier', () => {
  test('increases with rank', () => {
    expect(rankKdCheatMultiplier(1)).toBe(0.78);
    expect(rankKdCheatMultiplier(8)).toBe(1.22);
  });
  test('returns default for rank 0', () => {
    expect(rankKdCheatMultiplier(0)).toBe(0.9);
  });
});

describe('rankKdSmurfBoost', () => {
  test('returns 0 for low kd or no rank', () => {
    expect(rankKdSmurfBoost(1.2, 4)).toBe(0);
    expect(rankKdSmurfBoost(1.5, 0)).toBe(0);
  });
  test('boosts for high kd in low rank', () => {
    const boost = rankKdSmurfBoost(1.8, 4); // gold
    expect(boost).toBeGreaterThan(0);
  });
});

describe('winrateCheatContribution', () => {
  test('returns 0 for low winrate', () => {
    expect(winrateCheatContribution(40, true)).toBe(0);
  });
  test('returns correct tier for bands', () => {
    expect(winrateCheatContribution(58, true)).toBe(10);
    expect(winrateCheatContribution(70, true)).toBe(44);
    expect(winrateCheatContribution(80, true)).toBe(64);
  });
});

describe('largestSeasonGap', () => {
  test('returns 0 for <2 seasons', () => {
    expect(largestSeasonGap([1])).toBe(0);
  });
  test('computes max gap correctly', () => {
    expect(largestSeasonGap([1, 3, 7])).toBe(3); // gap 1→3 = 1, 3→7 = 3
  });
});

describe('onlyCurrentSeasonPlayed', () => {
  test('true only for current season alone', () => {
    expect(onlyCurrentSeasonPlayed([18])).toBe(true);
    expect(onlyCurrentSeasonPlayed([17, 18])).toBe(false);
    expect(onlyCurrentSeasonPlayed([17])).toBe(false);
  });
});

describe('analyzeProfile', () => {
  test('classifies a legit profile', () => {
    const res = analyzeProfile({
      kd: 0.9,
      winrate: 48,
      ranked: 200,
      level: 180,
      rankStep: 4,
      rankKey: 'gold',
      playedSeasons: [14, 15, 16, 17, 18],
    });
    expect(res.classification).toBe('legit');
    expect(res.finalScore).toBeLessThan(40);
    expect(res.verdict).toBe('clean');
    expect(res.reasons.length).toBeGreaterThan(0);
  });

  test('classifies a smurf profile', () => {
    const res = analyzeProfile({
      kd: 1.7,
      winrate: 60,
      ranked: 40,
      level: 60,
      rankStep: 4,
      rankKey: 'gold',
      playedSeasons: [18],
    });
    expect(res.classification).toBe('smurf');
    expect(res.smurfScore).toBeGreaterThan(res.cheatScore);
    expect(res.verdict).toBe('smurf');
  });

  test('classifies a suspect profile', () => {
    const res = analyzeProfile({
      kd: 2.2,
      winrate: 72,
      ranked: 400,
      level: 180,
      rankStep: 8,
      rankKey: 'champion',
      playedSeasons: [16, 17, 18],
    });
    expect(res.cheatScore).toBeGreaterThan(60);
    expect(res.finalScore).toBeGreaterThan(60);
    expect(res.verdict).toBe('suspect');
    expect(res.classification).toBe('possible cheater');
  });

  test('handles missing winrate gracefully', () => {
    const res = analyzeProfile({
      kd: 1.2,
      ranked: 150,
      level: 100,
      rankStep: 3,
      rankKey: 'silver',
      playedSeasons: [10, 11, 12],
    });
    expect(res.classification).toBe('legit');
    expect(res.verdict).toBe('clean');
  });

  test('reasons contain analysis text', () => {
    const res = analyzeProfile({
      kd: 1.5,
      winrate: 55,
      ranked: 100,
      level: 120,
      rankStep: 5,
      rankKey: 'platinum',
      playedSeasons: [15, 16, 17, 18],
    });
    const analysisReason = res.reasons.find(r => r.text.includes('Classification'));
    expect(analysisReason).toBeDefined();
    expect(analysisReason.text).toContain(res.classification);
  });
});
