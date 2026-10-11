#!/bin/bash

# Ensure the server is running on port 3000 before running this script
echo "--- Testing Quota Boundary Enforcement ---"

cat << 'EOF' > run-boundary-test.js
const db = require('./src/db');

async function run() {
  const fetchFn = globalThis.fetch;
  if (!fetchFn) {
    console.error('Global fetch is not available. Please run on Node.js v18+');
    process.exit(1);
  }

  // 1. Create a fresh tenant
  const tenantRes = await fetchFn('http://localhost:3000/api/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Quota Boundary Tester' })
  });
  const tenant = await tenantRes.json();
  const tenantId = tenant.id;

  console.log('Created Tenant:', tenantId);
  console.log('(Tenant is on Free plan: Limit = 1,000 API calls)');

  // 2. Pre-fill usage with 999 API calls directly in DB
  console.log('Pre-loading 999 API calls into usage_events...');
  await db.query(
    `INSERT INTO usage_events (tenant_id, idempotency_key, type, quantity) 
     VALUES ($1, $2, 'api_call', 999)`,
    [tenantId, 'boundary-filler-api']
  );

  // 3. Make Request #1,000 (Exact boundary - must SUCCEED)
  console.log('\n--- Request 1,000 (Should Succeed with 200) ---');
  const req1000 = await fetchFn('http://localhost:3000/generate', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      'x-idempotency-key': 'idem-boundary-1000'
    },
    body: JSON.stringify({ prompt: 'Call #1000' })
  });
  console.log('Status:', req1000.status);
  console.log('Body:', await req1000.json());

  // 4. Make Request #1,001 (Boundary exceeded - must REJECT with 429)
  console.log('\n--- Request 1,001 (Should Fail with 429 Too Many Requests) ---');
  const req1001 = await fetchFn('http://localhost:3000/generate', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      'x-idempotency-key': 'idem-boundary-1001'
    },
    body: JSON.stringify({ prompt: 'Call #1001' })
  });
  console.log('Status:', req1001.status);
  console.log('Body:', await req1001.json());
  
  await db.pool.end();
  process.exit(0);
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
EOF

node run-boundary-test.js
rm -f run-boundary-test.js
