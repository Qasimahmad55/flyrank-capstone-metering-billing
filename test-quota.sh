#!/bin/bash

# Ensure the server is running on port 3000 before running this script
echo "--- Testing Quota Boundary Enforcement ---"

# We create a new tenant using the API
echo -e "\n1. Creating a new Tenant..."
TENANT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Boundary Test Tenant"}')

TENANT_ID=$(echo $TENANT_RESPONSE | jq -r '.id')
if [ "$TENANT_ID" == "null" ] || [ -z "$TENANT_ID" ]; then
  echo "Failed to create tenant. Make sure your database and server are running."
  echo "Response: $TENANT_RESPONSE"
  exit 1
fi

echo "Created Tenant ID: $TENANT_ID"
echo "(This tenant starts on the Free Plan with 1,000 API calls limit)"

echo -e "\n2. Exhausting the API Call limit..."
# We use a loop but to keep the test script fast, let's just make 10 requests that use 100 API calls each (Wait, API calls are counted as 1 per request in our controller).
# So we either loop 1000 times, or manually insert a usage event to get us to 999.
echo "Simulating 999 API calls directly via DB would be faster, but let's just hit the endpoint 1000 times in parallel (this might take a few seconds)..."

# To avoid massive spam, let's just do a manual DB injection if we had access, but for the sake of the script, we can just do 1 request and then pretend.
# Actually, let's write a small Node.js script to simulate the usage event insertion to 999, then hit the boundary.
cat << 'EOF' > run-boundary-test.js
const db = require('./src/db');
const fetch = require('node-fetch'); // Ensure node-fetch or native fetch is available

async function run() {
  // Use native fetch (Node 18+)
  const tenantRes = await fetch('http://localhost:3000/api/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Quota Tester' })
  });
  const tenant = await tenantRes.json();
  const tenantId = tenant.id;

  console.log('Created Tenant:', tenantId);

  // Manually insert 999 API calls to get to the boundary
  console.log('Injecting 999 API calls into usage_events...');
  await db.query(
    `INSERT INTO usage_events (tenant_id, idempotency_key, type, quantity) 
     VALUES ($1, $2, $3, $4)`,
    [tenantId, 'boundary-filler-api', 'api_call', 999]
  );

  console.log('--- Request 1,000 (Should Succeed) ---');
  const req1000 = await fetch('http://localhost:3000/api/metering/generate', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      'x-idempotency-key': 'idem-1000'
    },
    body: JSON.stringify({ prompt: 'Test' })
  });
  console.log('Status:', req1000.status);
  console.log('Body:', await req1000.json());

  console.log('\n--- Request 1,001 (Should Fail with 429 Too Many Requests) ---');
  const req1001 = await fetch('http://localhost:3000/api/metering/generate', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      'x-idempotency-key': 'idem-1001'
    },
    body: JSON.stringify({ prompt: 'Test' })
  });
  console.log('Status:', req1001.status); // Expecting 429
  console.log('Body:', await req1001.json());
  
  process.exit(0);
}
run().catch(console.error);
EOF

node run-boundary-test.js
rm run-boundary-test.js
