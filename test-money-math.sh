#!/bin/bash

echo "--- Testing Money Math Rollup (Probe 5) ---"

echo -e "\n1. Creating a new Tenant for pricing test..."
TENANT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Money Math Tester"}')

TENANT_ID=$(echo $TENANT_RESPONSE | jq -r '.id')
IDEMPOTENCY_KEY="idem-price-1"

echo "Created Tenant ID: $TENANT_ID"

echo -e "\n2. Generating usage with specific token breakdown..."
echo "Simulating: 1M fresh input, 1M cached input, 1M output, 1M reasoning tokens"
# In our system:
# fresh input: 350 micro-cents per token
# cached input: 175 micro-cents per token
# output: 1050 micro-cents per token
# reasoning: 1050 micro-cents per token
# Expected Cost = (1M * 350) + (1M * 175) + (1M * 1050) + (1M * 1050) 
#               = 350,000,000 + 175,000,000 + 1,050,000,000 + 1,050,000,000 
#               = 2,625,000,000 micro-cents
#               = 2,625 cents ($26.25)

curl -s -X POST http://localhost:3000/api/metering/generate \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{
    "prompt": "Test exact pricing logic",
    "simulate_tokens": {
      "fresh_input": 1000000,
      "cached_input": 1000000,
      "output": 1000000,
      "reasoning": 1000000
    }
  }' | jq

echo -e "\n3. Fetching Usage Rollup..."
curl -s -X GET http://localhost:3000/api/usage \
  -H "x-tenant-id: $TENANT_ID" | jq

echo -e "\nIf current_cost_cents is exactly 2625, your money math is flawless!"
