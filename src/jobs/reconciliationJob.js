const Stripe = require('stripe');
const config = require('../config');
const db = require('../db');

const stripe = config.stripeSecretKey ? Stripe(config.stripeSecretKey) : null;

class ReconciliationJob {
  /**
   * Helper to execute an operation with exponential backoff retries.
   */
  static async withRetry(fn, maxRetries = 3, delayMs = 500) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) throw err;
        const backoff = delayMs * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, backoff));
      }
    }
  }

  /**
   * Runs the reconciliation audit comparing DB subscriptions against Stripe.
   */
  static async run() {
    console.log('[RECONCILIATION] Starting nightly subscription reconciliation audit...');
    const report = {
      started_at: new Date().toISOString(),
      checked_count: 0,
      mismatch_count: 0,
      synced_count: 0,
      errors: [],
      mismatches: [],
    };

    if (!stripe) {
      const msg = 'Stripe is not configured (missing STRIPE_SECRET_KEY). Skipping live Stripe audit.';
      console.warn(`[RECONCILIATION] ${msg}`);
      report.errors.push(msg);
      return report;
    }

    try {
      // 1. Fetch all local subscriptions that have a Stripe subscription ID
      const { rows: localSubs } = await db.query(
        `SELECT s.id, s.tenant_id, s.plan_id, s.status, s.stripe_subscription_id, t.name as tenant_name
         FROM subscriptions s
         JOIN tenants t ON s.tenant_id = t.id
         WHERE s.stripe_subscription_id IS NOT NULL`
      );

      report.checked_count = localSubs.length;

      // 2. Iterate and verify against Stripe source of truth
      for (const localSub of localSubs) {
        try {
          // Retrieve live subscription from Stripe with retry
          const stripeSub = await this.withRetry(() =>
            stripe.subscriptions.retrieve(localSub.stripe_subscription_id)
          );

          const stripeStatus = stripeSub.status;
          let hasMismatch = false;
          const mismatchDetails = {
            tenant_id: localSub.tenant_id,
            subscription_id: localSub.id,
            stripe_subscription_id: localSub.stripe_subscription_id,
            field_differences: {},
          };

          // Check status difference
          if (localSub.status !== stripeStatus) {
            hasMismatch = true;
            mismatchDetails.field_differences.status = {
              db: localSub.status,
              stripe: stripeStatus,
            };
          }

          if (hasMismatch) {
            report.mismatch_count++;
            report.mismatches.push(mismatchDetails);

            console.warn(
              `[RECONCILIATION ALERT] Desync detected for tenant ${localSub.tenant_id} (${localSub.tenant_name})! ` +
              `DB Status: "${localSub.status}" vs Stripe: "${stripeStatus}". Syncing DB to match Stripe...`
            );

            // Reconcile: Stripe is ultimate source of truth
            await db.query(
              `UPDATE subscriptions 
               SET status = $1 
               WHERE id = $2`,
              [stripeStatus, localSub.id]
            );

            report.synced_count++;
          }
        } catch (itemError) {
          const errMsg = `Failed to reconcile subscription ${localSub.stripe_subscription_id}: ${itemError.message}`;
          console.error(`[RECONCILIATION ERROR] ${errMsg}`);
          report.errors.push(errMsg);
        }
      }

      report.completed_at = new Date().toISOString();
      console.log(
        `[RECONCILIATION] Audit finished. Checked: ${report.checked_count}, ` +
        `Mismatches found: ${report.mismatch_count}, Synced: ${report.synced_count}, Errors: ${report.errors.length}`
      );
      return report;
    } catch (fatalError) {
      console.error('[RECONCILIATION FATAL]', fatalError);
      report.errors.push(`Fatal error: ${fatalError.message}`);
      return report;
    }
  }
}

module.exports = ReconciliationJob;
