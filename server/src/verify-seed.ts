import db from './database';

console.log('\n=== Database Verification ===\n');

// Count projects by status
const projectCounts = db.prepare(`
  SELECT status, COUNT(*) as count
  FROM projects
  GROUP BY status
`).all();

console.log('Projects by status:');
projectCounts.forEach((row: any) => {
  console.log(`  ${row.status}: ${row.count}`);
});

// Show sample active projects
console.log('\nSample Active Projects:');
const activeProjects = db.prepare(`
  SELECT code, name, client, contract_value, start_date, end_date
  FROM projects
  WHERE status='active'
  LIMIT 5
`).all();

activeProjects.forEach((p: any) => {
  console.log(`  ${p.code} - ${p.name}`);
  console.log(`    Client: ${p.client}`);
  console.log(`    Value: $${(p.contract_value / 1000000).toFixed(2)}M`);
  console.log(`    Duration: ${p.start_date} to ${p.end_date}\n`);
});

// Count other entities
const wbsCount = db.prepare('SELECT COUNT(*) as count FROM wbs_items').get() as any;
const claimsCount = db.prepare('SELECT COUNT(*) as count FROM progress_claims').get() as any;
const dailyLogsCount = db.prepare('SELECT COUNT(*) as count FROM daily_logs').get() as any;
const variationsCount = db.prepare('SELECT COUNT(*) as count FROM variations').get() as any;
const plantCount = db.prepare('SELECT COUNT(*) as count FROM plant_types').get() as any;
const labourCount = db.prepare('SELECT COUNT(*) as count FROM labour_types').get() as any;
const materialCount = db.prepare('SELECT COUNT(*) as count FROM material_types').get() as any;

console.log('Database Statistics:');
console.log(`  WBS Items: ${wbsCount.count}`);
console.log(`  Progress Claims: ${claimsCount.count}`);
console.log(`  Daily Logs: ${dailyLogsCount.count}`);
console.log(`  Variations: ${variationsCount.count}`);
console.log(`  Plant Types: ${plantCount.count}`);
console.log(`  Labour Types: ${labourCount.count}`);
console.log(`  Material Types: ${materialCount.count}`);

console.log('\n=== Verification Complete ===\n');
