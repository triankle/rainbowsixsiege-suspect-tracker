const { hashPassword } = require('../lib/auth.js');

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: node scripts/hash-password.cjs <password-at-least-12-chars>');
  process.exit(1);
}

console.log(hashPassword(password));
