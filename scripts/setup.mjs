// One-step setup for a new computer: `npm run setup`
//  1. Creates .env if it is missing (random secret key and admin password),
//     or fills in placeholder values copied from .env.example.
//  2. Prepares the database client, creates/updates the database, and adds the first admin.
//  3. Prints how to log in.
// Safe to run again: it never overwrites real values already in .env or data in the database.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ENV_FILE = '.env';
const DEFAULT_EMAIL = 'admin@indooracademy.in';
const PLACEHOLDERS = new Set(['replace-with-a-long-random-string', 'choose-a-strong-password', '']);

const newSecret = () => randomBytes(32).toString('base64url');
const newPassword = () => `IA-${randomBytes(6).toString('base64url')}`;

function readEnv(text) {
  const vars = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

function setVar(text, key, value) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  return re.test(text) ? text.replace(re, () => line) : `${text.trimEnd()}\n${line}\n`;
}

// ---- 1. .env ----
const changes = [];
let text;
if (!existsSync(ENV_FILE)) {
  text = [
    '# Created by `npm run setup`. Keep this file private: it is not uploaded to GitHub.',
    '',
    '# Local database file (relative to prisma/schema.prisma)',
    'DATABASE_URL="file:./dev.db"',
    '',
    '# Secret used to sign logins. Never share it.',
    `AUTH_SECRET="${newSecret()}"`,
    '',
    '# First admin account, created only when the database has no users yet.',
    '# Change the password from Settings after logging in.',
    'ADMIN_NAME="Academy Admin"',
    `ADMIN_EMAIL="${DEFAULT_EMAIL}"`,
    `ADMIN_PASSWORD="${newPassword()}"`,
    '',
    '# Only for `npm start` over plain http on a local network. Leave unset on HTTPS.',
    '# COOKIE_SECURE="false"',
    '',
  ].join('\n');
  changes.push('created .env');
} else {
  text = readFileSync(ENV_FILE, 'utf8');
  const vars = readEnv(text);
  if (!vars.DATABASE_URL) { text = setVar(text, 'DATABASE_URL', 'file:./dev.db'); changes.push('DATABASE_URL'); }
  if (!vars.AUTH_SECRET || PLACEHOLDERS.has(vars.AUTH_SECRET) || vars.AUTH_SECRET.length < 32) { text = setVar(text, 'AUTH_SECRET', newSecret()); changes.push('AUTH_SECRET'); }
  if (!vars.ADMIN_NAME) { text = setVar(text, 'ADMIN_NAME', 'Academy Admin'); changes.push('ADMIN_NAME'); }
  if (!vars.ADMIN_EMAIL) { text = setVar(text, 'ADMIN_EMAIL', DEFAULT_EMAIL); changes.push('ADMIN_EMAIL'); }
  if (!vars.ADMIN_PASSWORD || PLACEHOLDERS.has(vars.ADMIN_PASSWORD)) { text = setVar(text, 'ADMIN_PASSWORD', newPassword()); changes.push('ADMIN_PASSWORD'); }
}
if (changes.length) {
  writeFileSync(ENV_FILE, text);
  console.log(`\n.env: ${changes.join(', ')}`);
} else {
  console.log('\n.env already complete, not changed.');
}
const env = readEnv(text);

// ---- 2. database ----
function step(label, args) {
  console.log(`\n> ${label}`);
  // Fixed arguments only (no user input), passed as one command line for Windows' npx.cmd.
  const r = spawnSync(`npx prisma ${args.join(' ')}`, { stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\nSetup stopped: "${label}" failed.`);
    console.error('If the app is running (npm run dev), stop it with Ctrl+C and run `npm run setup` again.');
    process.exit(r.status ?? 1);
  }
}
step('Preparing the database client', ['generate']);
step('Creating / updating the database', ['migrate', 'deploy']);

const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
const usersBefore = await db.user.count();
await db.$disconnect();

step('Adding the first admin and branches', ['db', 'seed']);

// ---- 3. how to log in ----
const line = '='.repeat(60);
console.log(`\n${line}\n  Setup complete.\n`);
console.log('  Start the app:   npm run dev');
console.log('  Then open:       http://localhost:3000\n');
if (usersBefore === 0) {
  console.log(`  Admin email:     ${env.ADMIN_EMAIL}`);
  console.log(`  Admin password:  ${env.ADMIN_PASSWORD}`);
  console.log('\n  (Also saved in .env. Change it from Settings after logging in.)');
} else {
  console.log('  The database already had users, so no new admin was made.');
  console.log('  Log in with your existing account.');
}
console.log(`${line}\n`);
