const { RANK_ORDER, analyzeProfile } = require('../analyze.js');
const { createSubmissionRepository } = require('../repositories/submission-repository.js');

function toAnalysisInput(input) {
  return {
    kd: input.kd,
    winrate: input.winrate == null ? undefined : input.winrate,
    ranked: input.ranked,
    level: input.level,
    rankKey: input.rankKey,
    rankStep: input.rankKey ? RANK_ORDER[input.rankKey] || 0 : 0,
    playedSeasons: input.playedSeasons,
  };
}

function analyzeSubmission(input) {
  return analyzeProfile(toAnalysisInput(input));
}

function toCreateData(input, analysis = analyzeSubmission(input)) {
  return {
    pseudo: input.pseudo,
    kd: input.kd,
    winrate: input.winrate,
    rankedMatches: input.ranked,
    accountLevel: input.level,
    rankKey: input.rankKey,
    seasonsPlayed: input.playedSeasons,
    verdict: analysis.verdict,
    verdictLabel: analysis.verdictLabel,
    cheatScore: analysis.cheatScore,
    smurfScore: analysis.smurfScore,
    reasonsJson: analysis.reasons,
  };
}

function toPublicRow(row) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    pseudo: row.pseudo,
    kd: row.kd != null ? Number(row.kd) : null,
    winrate: row.winrate != null ? Number(row.winrate) : null,
    rankedMatches: row.rankedMatches,
    accountLevel: row.accountLevel,
    rankKey: row.rankKey,
    seasonsPlayed: row.seasonsPlayed,
    verdict: row.verdict,
    verdictLabel: row.verdictLabel,
    cheatScore: row.cheatScore != null ? Number(row.cheatScore) : null,
    smurfScore: row.smurfScore != null ? Number(row.smurfScore) : null,
    reasonsJson: row.reasonsJson,
  };
}

function toStatsPayload(stats) {
  return {
    total: stats.total,
    averages: {
      kd: stats.agg._avg.kd != null ? Number(stats.agg._avg.kd) : null,
      winrate: stats.agg._avg.winrate != null ? Number(stats.agg._avg.winrate) : null,
      cheatScore: stats.agg._avg.cheatScore != null ? Number(stats.agg._avg.cheatScore) : null,
      smurfScore: stats.agg._avg.smurfScore != null ? Number(stats.agg._avg.smurfScore) : null,
    },
    lastSubmission: stats.agg._max.createdAt || null,
    verdicts: stats.verdicts.map((v) => ({
      verdict: v.verdict,
      count: v._count.verdict,
    })),
  };
}

function createSubmissionService(prisma) {
  const repository = createSubmissionRepository(prisma);

  return {
    analyzeSubmission,

    async createSubmission(input) {
      const analysis = analyzeSubmission(input);
      const row = await repository.create(toCreateData(input, analysis));
      return { row, analysis };
    },

    async listEntries(query) {
      const { rows, total } = await repository.findManyWithCount(query);
      return {
        rows: rows.map(toPublicRow),
        total,
      };
    },

    async getStats() {
      return toStatsPayload(await repository.getStats());
    },

    async getExportRows(query) {
      return repository.findForExport(query);
    },
  };
}

module.exports = {
  analyzeSubmission,
  createSubmissionService,
  toCreateData,
  toPublicRow,
};
