/**
 * PrismaClient singleton pour l’API Node (local-dev.cjs, Vercel /api/*.js).
 * Ne pas nommer ce fichier prisma.js : Next résoudrait @/lib/prisma vers le .js au lieu du .ts.
 */
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

function getPrisma() {
  if (!globalForPrisma.__prismaClient) {
    globalForPrisma.__prismaClient = new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? ['error', 'warn']
          : ['error'],
    });
  }
  return globalForPrisma.__prismaClient;
}

module.exports = { getPrisma };
