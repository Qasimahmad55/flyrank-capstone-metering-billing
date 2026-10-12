const ReconciliationJob = require('../src/jobs/reconciliationJob');
const db = require('../src/db');

async function main() {
  try {
    const report = await ReconciliationJob.run();
    console.log('[RECONCILIATION REPORT]', JSON.stringify(report, null, 2));
  } catch (err) {
    console.error('[RECONCILIATION FAILED]', err);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

main();
