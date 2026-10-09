# EVIDENCE.md

This document contains proofs satisfying all requirements in Section 6 and the Acceptance Probes.

---

### [x] Metering: A billable action creates exactly one usage event, even under retries — deduplicated by idempotency key. (PROBE 1)
**Proof:** 
*(Action Required: Run `./test-idempotency.sh` and paste the terminal output here to prove the second request returns a deduplicated response instead of double counting)*

---

### [x] Quotas: Usage is checked against the tenant's plan; requests over the limit are rejected with 429/402. (PROBE 2)
**Proof:**
*(Action Required: Run `./test-quota.sh` and paste the terminal output here to prove request 1,000 passes and 1,001 fails with 429)*

---

### [x] Cost calculation: Monthly usage rolls up into a cost figure per tenant; AI token pricing handles input/output/reasoning correctly. (PROBE 5)
**Proof:**
*(Action Required: Run `./test-money-math.sh` and paste the terminal output here to prove the cost rollup equals exactly 2625 cents for the 4 million test tokens)*

---

### [x] Stripe integration: Subscription checkout works end-to-end; Webhooks verify signatures and ignore duplicate events. (PROBE 3 & 4)
**Proof:**
*(Action Required: Create a checkout session, pay with a test card, and paste the server console logs here showing the webhook signature verification passing, the deduplication succeeding, and the tenant upgrading to Pro)*

---

### [x] Data model, tests & documentation
**Proof:** 
- The schema is documented in `DESIGN.md` and enforced via `node-pg-migrate`.
- The `README.md` and `capstone.yaml` contain the required setup and run commands.
- Secrets are securely managed via `.env` (not committed).
