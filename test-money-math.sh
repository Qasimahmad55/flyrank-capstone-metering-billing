#!/bin/bash

echo "--- Testing Money Math Rollup (Probe 5) ---"

echo -e "\n1. Creating a new Tenant for pricing test..."
TENANT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Money Math Tester"}')

TENANT_ID=$(echo "$TENANT_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
IDEMPOTENCY_KEY="idem-price-$(date +%s)-$RANDOM"

if [ -z "$TENANT_ID" ]; then
  echo "Failed to create tenant. Response: $TENANT_RESPONSE"
  exit 1
fi

echo "Created Tenant ID: $TENANT_ID"

echo -e "\n2. Generating usage with specific token breakdown..."
echo "Simulating: 1M fresh input, 1M cached input, 1M output, 1M reasoning tokens"
# Expected Cost = (1M * 350) + (1M * 175) + (1M * 1050) + (1M * 1050) micro-cents
#               = 2,625,000,000 micro-cents = 2,625 cents ($26.25)

curl -s -X POST http://localhost:3000/generate \
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
  }'

echo -e "\n\n3. Fetching Usage Rollup..."
curl -s -X GET http://localhost:3000/usage \
  -H "x-tenant-id: $TENANT_ID"

echo -e "\n\nIf current_cost_cents or base_cost_cents is exactly 2625 ($26.25), money math is verified!"
