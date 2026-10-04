const fs = require('fs');
const map = [
  ['t0000001-0000-0000-0000-', 'd0000001-0000-4000-8000-'],
  ['m0000001-0000-0000-0000-', 'e0000001-0000-4000-8000-'],
  ['c0000001-0000-0000-0000-', 'c0000001-0000-4000-8000-'],
  ['b0000001-0000-0000-0000-', 'b0000001-0000-4000-8000-'],
  ['11111111-0000-0000-0000-', '11111111-0000-4000-8000-'],
  ['22222222-0000-0000-0000-', '22222222-0000-4000-8000-']
];
for (const f of ['supabase/migrations/20261004_seed_tamilnadu_data.sql', 'scripts/seed-tamilnadu-db.js']) {
  let t = fs.readFileSync(f, 'utf8');
  for (const [a, b] of map) t = t.split(a).join(b);
  fs.writeFileSync(f, t);
}
const sql = fs.readFileSync('supabase/migrations/20261004_seed_tamilnadu_data.sql', 'utf8');
console.log('invalid ids left:', (sql.match(/'[tm]0000001/g) || []).length);
