#!/usr/bin/env node
/**
 * fix-payments-plan-check.js — removes the hardcoded ['pro','elite'] plan
 * whitelist from POST /payments/orders so any plan in
 * settings.subscriptionPlans (e.g. "premium") can be purchased.
 *
 * Works from anywhere inside your server project. Backs up the original
 * (routes/payments.js.bak-<timestamp>) and validates the patched file
 * compiles before keeping it; restores the backup if it doesn't.
 *
 * Run: node fix-payments-plan-check.js
 *
 * Afterwards it lists every remaining 'pro'/'elite' string literal in your
 * server code so you can spot other hardcoded plan lists.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function findServerRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'models'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const ROOT = findServerRoot(process.cwd()) || findServerRoot(__dirname);
console.log('\n🔧 Payments plan-check fix\n' + '='.repeat(50));
if (!ROOT) { console.log('\n❌ Could not find your server root (needs package.json + models/).\n'); process.exit(1); }

const target = path.join(ROOT, 'routes', 'payments.js');
if (!fs.existsSync(target)) { console.log(`\n❌ ${target} not found.\n`); process.exit(1); }

const MARKER = '// DYNAMIC-PLAN-CHECK';
const original = fs.readFileSync(target, 'utf8');

// Tolerates single/double quotes and whitespace differences
const HARDCODED = /if\s*\(\s*!\s*\[\s*['"]pro['"]\s*,\s*['"]elite['"]\s*\]\s*\.includes\(\s*plan\s*\)\s*\)\s*return\s+res\.status\(\s*400\s*\)\.json\(\s*\{\s*error\s*:\s*['"]Invalid plan['"]\s*\}\s*\)\s*;?/;

const REPLACEMENT =
  `${MARKER} — validated against settings.subscriptionPlans below, not a hardcoded list\n` +
  `    if (typeof plan !== 'string' || !plan.trim()) return res.status(400).json({ error: 'Invalid plan' });`;

if (original.includes(MARKER)) {
  console.log('\n✅ Already patched — nothing to do.');
} else if (!HARDCODED.test(original)) {
  console.log('\n⚠️  Could not find the exact hardcoded check, so I changed nothing.');
  console.log('   Lines mentioning "Invalid plan" in your file (paste these to me):\n');
  original.split('\n').forEach((line, i) => { if (/Invalid plan/.test(line)) console.log(`   line ${i + 1}: ${line.trim()}`); });
  console.log('');
  process.exit(1);
} else {
  const patched = original.replace(HARDCODED, REPLACEMENT);

  // Validate it still compiles before touching disk
  try {
    new vm.Script(`(function(exports, require, module, __filename, __dirname){${patched}\n})`, { filename: target });
  } catch (err) {
    console.log(`\n❌ Patched file would not compile (${err.message}). Nothing was written.\n`);
    process.exit(1);
  }

  const backup = `${target}.bak-${Date.now()}`;
  fs.writeFileSync(backup, original);
  fs.writeFileSync(target, patched);
  console.log(`\n✅ Patched routes/payments.js`);
  console.log(`   Backup: ${path.relative(ROOT, backup)}`);
  console.log('   Restart your server to apply.');
}

// ── Scan for other hardcoded plan names ─────────────────────────────────────
console.log('\n' + '-'.repeat(50));
console.log("Remaining 'pro' / 'elite' string literals in server code:");
console.log('(many are legitimate — seed data, labels — but a list like');
console.log("['pro','elite'] or `plan === 'pro'` deciding access is suspect)\n");

const SKIP = new Set(['node_modules', '.git', 'uploads']);
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js') && !entry.name.includes('.bak-')) out.push(full);
  }
  return out;
}
let total = 0;
for (const file of walk(ROOT)) {
  if (path.basename(file) === 'fix-payments-plan-check.js') continue;
  const hits = [];
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/['"]pro['"]|['"]elite['"]/.test(line) && !/^\s*(\/\/|\*)/.test(line)) hits.push(`   ${i + 1}: ${line.trim().slice(0, 110)}`);
  });
  if (hits.length) { total += hits.length; console.log(path.relative(ROOT, file)); hits.forEach(h => console.log(h)); console.log(''); }
}
if (!total) console.log('   (none)\n');
