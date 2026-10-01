# Usage Metering & Billing Engine Design Document

## 1. Problem Statement
SaaS platforms need to accurately track customer usage, enforce limits based on subscription plans, and bill correctly without ever double-charging. This system will meter API usage and AI tokens, enforce tier limits, and sync subscription states using Stripe test webhooks.

## 2. Plans and Quotas
We offer two plans:
- **Free Plan**: 1,000 API calls / month, 100k AI tokens / month.
- **Pro Plan**: 10,000 API calls / month, 1M AI tokens / month.

## 3. Database Schema (PostgreSQL)

### `tenants`
- `id` (UUID, PK)
- `name` (String)
- `stripe_customer_id` (String, Unique)
- `created_at` (Timestamp)

### `plans`
- `id` (String, PK) e.g., 'free', 'pro'
- `name` (String)
- `api_call_limit` (Integer)
- `ai_token_limit` (Integer)

### `subscriptions`
- `id` (UUID, PK)
- `tenant_id` (UUID, FK -> tenants)
- `plan_id` (String, FK -> plans)
- `stripe_subscription_id` (String, Unique)
- `status` (String) e.g., 'active', 'past_due'
- `current_period_start` (Timestamp)
- `current_period_end` (Timestamp)

### `usage_events`
- `id` (UUID, PK)
- `tenant_id` (UUID, FK -> tenants)
- `idempotency_key` (String, Unique per tenant)
- `type` (String) e.g., 'api_call', 'ai_tokens'
- `quantity` (Integer)
- `timestamp` (Timestamp)

## 4. API Contract

### `POST /generate`
**Description:** Dummy billable endpoint that simulates a generative action. Records usage and enforces quotas.
**Headers:**
- `x-tenant-id`: UUID
- `x-idempotency-key`: String (UUID)
**Body:**
```json
{
  "prompt": "Hello world",
  "simulate_tokens": {
    "cached_input": 100,
    "fresh_input": 50,
    "output": 200,
    "reasoning": 0
  }
}
```
**Responses:**
- `200 OK`: Successful generation, usage recorded.
- `429 Too Many Requests`: Usage limit exceeded for the current plan.
- `402 Payment Required`: Subscription lapsed or requires payment.

### `GET /usage`
**Description:** Returns the current usage rollup for the billing period.
**Headers:**
- `x-tenant-id`: UUID
**Response (200 OK):**
```json
{
  "api_calls": { "used": 500, "limit": 1000 },
  "ai_tokens": { "used": 25000, "limit": 100000 },
  "current_cost_cents": 150
}
```

## 5. Idempotency Strategy
- The client must pass `x-idempotency-key` in the header of the `POST /generate` request.
- The system will attempt to insert a record into the `usage_events` table with a unique constraint on `(tenant_id, idempotency_key)`.
- If a conflict occurs (duplicate key), the database will reject the insertion. We will catch this error and return a successful `200 OK` with a message indicating the request was deduplicated (returning the original result). This guarantees we never double-count usage on retried network requests.

## 6. Explicit Non-Goal
Real-world payment processing and credit card handling are out of scope; all billing will be conducted exclusively using Stripe Test Mode. Complex invoicing and proration are considered stretch goals and not part of the initial core logic.
