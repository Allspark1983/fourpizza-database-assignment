const { randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const template = readFileSync(path.join(root, '.env.example'), 'utf8');
const settings = template.replace(/^JWT_SECRET=$/m, 'JWT_SECRET=' + randomBytes(32).toString('hex'));
try {
  writeFileSync(path.join(root, '.env'), settings, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with a new sign-in secret. Add your database connection and DeepSeek key there.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Your existing .env is ready to edit.');
}
