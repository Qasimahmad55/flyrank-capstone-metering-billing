# BUILDLOG.md — AI Usage Disclosure

## AI Pairing Details
- **AI Tool Used**: Antigravity AI (Gemini)
- **Role**: Backend Pair Programmer & Architecture Consultant

---

## 1. Where AI Helped
- **Scaffolding & Architecture**: Fast setup of Express.js layered architecture (separating controllers, business services, database queries, and migrations).
- **Docker & PostgreSQL Migrations**: Created database migration scripts with `node-pg-migrate` enforcing strict constraints (such as `UNIQUE(tenant_id, idempotency_key)`).
- **Money Math Algorithms**: Encoded token pricing models in integer micro-cents, avoiding JavaScript IEEE-754 floating-point rounding bugs when aggregating millions of tokens.
- **Stripe & Webhook Integration**: Drafted Stripe Checkout and webhook handling logic with cryptographic signature verification.
- **Integration Test Scenarios**: Generated comprehensive automated test cases with Jest & Supertest, including boundary injection scripts.

---

## 2. Where AI Was Wrong / What Needed Correction
1. **Raw Body Middleware Ordering**: During early webhook implementation, `express.json()` was mounted globally before the Stripe webhook endpoint. This parsed incoming payloads into JS objects, which broke `stripe.webhooks.constructEvent()` (which strictly requires the unaltered Buffer). We corrected `src/index.js` to mount `/webhooks` prior to `express.json()`.
2. **Idempotency Quota Lockout Bug**: The initial metering flow checked tenant quotas *before* checking whether the incoming idempotency key had already been processed. When a tenant was at their exact limit (e.g. 1,000 / 1,000 calls) and retried an already-processed request, it would erroneously return `429 Too Many Requests` instead of mirroring the original 200 response. We added pre-quota idempotency lookup to guarantee idempotent retries succeed even at boundary limits.
3. **Template Literal Escapes**: In several written files, backticks and `${...}` expressions were escaped with backslashes during template string generation, causing Node syntax parsing errors. We performed a full repository audit and corrected all template strings.
4. **Foreign Key Seeding Dependency**: On fresh databases, creating a tenant would fail if the `free` plan hadn't been manually seeded. We updated `TenantService` to automatically ensure default plans exist.

---

## 3. What I Changed / What I Own
- I directed the entire project schedule and verified all 14-day deliverables against the capstone brief.
- I validated the multi-tenant isolation model and ensured that tenant data is never leaked across boundaries.
- I independently reviewed all database constraints, error codes (such as catching PostgreSQL `23505`), and boundary responses (`429` vs `402`).
- I am fully prepared to explain any line of code across the database schema, business logic services, or webhook verification pipeline.
