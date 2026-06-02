function buildEntriesWhere(query) {
  return {
    ...(query.pseudo ? { pseudo: { contains: query.pseudo, mode: 'insensitive' } } : {}),
    ...(query.verdict ? { verdict: query.verdict } : {}),
    ...(query.rank ? { rankKey: query.rank } : {}),
    ...(query.minScore != null
      ? {
          OR: [
            { cheatScore: { gte: query.minScore } },
            { smurfScore: { gte: query.minScore } },
          ],
        }
      : {}),
  };
}

function getSort(query) {
  return query.sort.startsWith('-')
    ? [query.sort.slice(1), 'desc']
    : [query.sort, 'asc'];
}

function createSubmissionRepository(prisma) {
  return {
    create(data) {
      return prisma.suspectSubmission.create({
        data,
        select: { id: true, createdAt: true },
      });
    },

    async findManyWithCount(query) {
      const where = buildEntriesWhere(query);
      const [sortField, sortDirection] = getSort(query);
      const [rows, total] = await Promise.all([
        prisma.suspectSubmission.findMany({
          where,
          orderBy: { [sortField]: sortDirection },
          skip: query.offset,
          take: query.limit,
        }),
        prisma.suspectSubmission.count({ where }),
      ]);

      return { rows, total };
    },

    findForExport(query) {
      const [sortField, sortDirection] = getSort(query);
      return prisma.suspectSubmission.findMany({
        where: buildEntriesWhere(query),
        orderBy: { [sortField]: sortDirection },
        take: Math.min(query.limit, 200),
        skip: query.offset,
      });
    },

    async getStats() {
      const [total, agg, verdicts] = await Promise.all([
        prisma.suspectSubmission.count(),
        prisma.suspectSubmission.aggregate({
          _avg: {
            kd: true,
            winrate: true,
            cheatScore: true,
            smurfScore: true,
          },
          _max: {
            createdAt: true,
          },
        }),
        prisma.suspectSubmission.groupBy({
          by: ['verdict'],
          _count: { verdict: true },
          orderBy: { _count: { verdict: 'desc' } },
        }),
      ]);

      return { total, agg, verdicts };
    },
  };
}

module.exports = {
  buildEntriesWhere,
  createSubmissionRepository,
};
