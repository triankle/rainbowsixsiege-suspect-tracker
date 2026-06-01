const { spawnSync } = require('child_process');

const commands = [
  ['node', ['-c', 'api/submissions.js']],
  ['node', ['-c', 'api/entries.js']],
  ['node', ['-c', 'api/stats.js']],
  ['node', ['-c', 'api/export.csv.js']],
  ['node', ['-c', 'api/auth/login.js']],
  ['node', ['-c', 'api/auth/me.js']],
  ['node', ['-c', 'api/v1/submissions.js']],
  ['node', ['-c', 'api/v1/entries.js']],
  ['node', ['-c', 'api/v1/stats.js']],
  ['node', ['-c', 'api/v1/export.csv.js']],
  ['node', ['-c', 'api/v1/auth/login.js']],
  ['node', ['-c', 'api/v1/auth/me.js']],
  ['node', ['-c', 'scripts/local-dev.cjs']],
  ['node', ['-c', 'prisma/seed.cjs']],
  ['node', ['-c', 'lib/analyze.js']],
  ['node', ['-c', 'lib/api-response.js']],
  ['node', ['-c', 'lib/auth.js']],
  ['node', ['-c', 'lib/validation.js']],
  ['node', ['-c', 'public/script.js']],
  ['node', ['-c', 'public/scripts/api-client.js']],
  ['node', ['-c', 'public/scripts/report-utils.js']],
  ['npm', ['run', 'db:validate']],
  ['npm', ['test']],
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'build']],
];

for (const [cmd, args] of commands) {
  const label = [cmd, ...args].join(' ');
  console.log(`\n> ${label}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`\nCheck failed: ${label}`);
    process.exit(result.status || 1);
  }
}

console.log('\nAll checks passed.');
