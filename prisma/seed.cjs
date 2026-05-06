const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const demoRows = [
  {
    pseudo: 'Demo.Clean',
    kd: 1.12,
    winrate: 51.8,
    rankedMatches: 420,
    accountLevel: 188,
    rankKey: 'gold',
    seasonsPlayed: [12, 13, 14, 15, 16, 17, 18],
    verdict: 'clean',
    verdictLabel: 'Profile looks consistent with normal ranked history.',
    cheatScore: 18,
    smurfScore: 12,
    reasonsJson: [
      { type: 'positive', text: 'Large ranked sample size.' },
      { type: 'positive', text: 'Several ranked seasons played.' },
    ],
  },
  {
    pseudo: 'Demo.Smurf',
    kd: 1.76,
    winrate: 63.4,
    rankedMatches: 82,
    accountLevel: 57,
    rankKey: 'platinum',
    seasonsPlayed: [18],
    verdict: 'smurf',
    verdictLabel: 'Strong smurf-like signals: low level, strong rank, only current season.',
    cheatScore: 38,
    smurfScore: 82,
    reasonsJson: [
      { type: 'negative', text: 'Low account level for ranked performance.' },
      { type: 'negative', text: 'Only current ranked season selected.' },
    ],
  },
  {
    pseudo: 'Demo.Suspect',
    kd: 2.35,
    winrate: 78.1,
    rankedMatches: 64,
    accountLevel: 91,
    rankKey: 'emerald',
    seasonsPlayed: [17, 18],
    verdict: 'suspect',
    verdictLabel: 'Very high K/D and win rate on a small ranked sample.',
    cheatScore: 88,
    smurfScore: 46,
    reasonsJson: [
      { type: 'negative', text: 'K/D is extremely high for the sample size.' },
      { type: 'negative', text: 'Win rate is abnormally high.' },
    ],
  },
];

async function main() {
  for (const row of demoRows) {
    await prisma.suspectSubmission.create({ data: row });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
