#!/bin/bash

# Ensure the server is running on port 3000 before running this script

echo "--- Generating a unique idempotency key and tenant ID ---"
TENANT_ID=$(uuidgen || echo "123e4567-e89b-12d3-a456-426614174000")
IDEMPOTENCY_KEY=$(uuidgen || echo "idem-12345")

echo "Using Tenant ID: $TENANT_ID"
echo "Using Idempotency Key: $IDEMPOTENCY_KEY"

echo -e "\n--- First Request (Should be recorded) ---"
curl -s -X POST http://localhost:3000/api/metering/generate \
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
  }' | jq || echo "Please install jq for pretty JSON output, or run curl manually."

echo -e "\n\n--- Second Request with SAME Idempotency Key (Should be deduplicated) ---"
curl -s -X POST http://localhost:3000/api/metering/generate \
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
  }' | jq || echo "Run finished."

echo -e "\n\nDone! Copy the output of this script into your EVIDENCE.md for Probe 1."
