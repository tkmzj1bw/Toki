import { readFileSync } from 'node:fs';
const p = new URL('./cases.jsonl', import.meta.url);
const rows = readFileSync(p, 'utf8').trim().split('\n').map(JSON.parse);
const groups = new Map();
for (const r of rows.filter(r => r.error)) {
  if (!groups.has(r.error)) groups.set(r.error, []);
  groups.get(r.error).push(r.args);
}
console.log('--- errors ---');
for (const [k, v] of groups) {
  console.log(`${v.length}x ${JSON.stringify(k)}`);
  for (const a of v.slice(0, 2)) console.log('   ', JSON.stringify(a).slice(0, 250));
}
console.log('--- reasons ---');
const reasons = new Map();
for (const r of rows.filter(r => r.ok && r.fn === 'validateCommand')) {
  const k = r.ok.reason ?? 'OK';
  reasons.set(k, (reasons.get(k) ?? 0) + 1);
}
for (const [k, v] of reasons) console.log(`${v}x ${JSON.stringify(k)}`);
console.log('--- unicode/token traps ---');
for (const r of rows.filter(r => r.fn === 'validateCommand' && r.ok)) {
  const raw = r.args[0] ?? '';
  if (/[^\x00-\x7F]/.test(raw)) console.log(JSON.stringify([raw, r.ok]));
}
