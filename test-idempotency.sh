#!/bin/bash

# Ensure the server is running on port 3000 before running this script

echo "--- Creating a fresh tenant for Idempotency Test ---"
TENANT_RES=$(curl -s -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Idempotency Test Tenant"}')

TENANT_ID=$(echo "$TENANT_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$TENANT_ID" ]; then
  echo "Failed to create tenant. Ensure server and database are running."
  echo "Server response: $TENANT_RES"
  exit 1
fi

IDEMPOTENCY_KEY="idem-test-$(date +%s)-$RANDOM"

echo "Using Tenant ID: $TENANT_ID"
echo "Using Idempotency Key: $IDEMPOTENCY_KEY"

echo -e "\n--- First Request (Should be recorded) ---"
curl -s -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{
    "prompt": "Write a poem about idempotency",
    "simulate_tokens": {
      "cached_input": 100,
      "fresh_input": 50,
      "output": 200,
      "reasoning": 0
    }
  }'

echo -e "\n\n--- Second Request with SAME Idempotency Key (Should be deduplicated) ---"
curl -s -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{
    "prompt": "Write a poem about idempotency",
    "simulate_tokens": {
      "cached_input": 100,
      "fresh_input": 50,
      "output": 200,
      "reasoning": 0
    }
  }'

echo -e "\n\nDone! Copy the output of this script into your EVIDENCE.md for Probe 1."
