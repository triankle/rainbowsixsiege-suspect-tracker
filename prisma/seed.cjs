const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../lib/auth.js');
const { toCreateData } = require('../lib/services/submission-service.js');

const prisma = new PrismaClient();

const demoInputs = [
  {
    pseudo: 'Demo.Clean',
    kd: 1.12,
    winrate: 51.8,
    ranked: 420,
    level: 188,
    rankKey: 'gold',
    playedSeasons: [12, 13, 14, 15, 16, 17, 18],
  },
  {
    pseudo: 'Demo.Smurf',
    kd: 1.76,
    winrate: 63.4,
    ranked: 82,
    level: 57,
    rankKey: 'platinum',
    playedSeasons: [18],
  },
  {
    pseudo: 'Demo.Suspect',
    kd: 2.35,
    winrate: 78.1,
    ranked: 64,
    level: 91,
    rankKey: 'emerald',
    playedSeasons: [17, 18],
  },
  {
    pseudo: 'Demo.Uncertain',
    kd: 1.42,
    winrate: 58.4,
    ranked: 145,
    level: 132,
    rankKey: 'gold',
    playedSeasons: [15, 16, 18],
  },
  {
    pseudo: 'Demo.Veteran',
    kd: 1.28,
    winrate: 54.2,
    ranked: 680,
    level: 241,
    rankKey: 'diamond',
    playedSeasons: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  },
];

const demoUsers = [
  {
    username: 'admin',
    email: 'admin@demo.local',
    password: 'Demo1234!Demo',
    role: 'ADMIN',
  },
  {
    username: 'moderator',
    email: 'moderator@demo.local',
    password: 'Demo1234!Demo',
    role: 'MODERATOR',
  },
  {
    username: 'viewer',
    email: 'viewer@demo.local',
    password: 'Demo1234!Demo',
    role: 'VIEWER',
  },
];

async function main() {
  for (const user of demoUsers) {
    await prisma.authUser.upsert({
      where: { username: user.username },
      update: {
        email: user.email,
        role: user.role,
        isActive: true,
        passwordHash: hashPassword(user.password),
        tokenVersion: { increment: 1 },
      },
      create: {
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: true,
        passwordHash: hashPassword(user.password),
      },
    });
  }

  const pseudos = demoInputs.map((row) => row.pseudo);
  await prisma.suspectSubmission.deleteMany({
    where: { pseudo: { in: pseudos } },
  });
  await prisma.suspectSubmission.createMany({
    data: demoInputs.map((input) => toCreateData(input)),
  });
  console.log(`Seeded ${demoUsers.length} demo users and ${demoInputs.length} demo suspect submissions.`);
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
