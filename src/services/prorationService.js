const SubscriptionModel = require('../models/subscriptionModel');
const db = require('../db');

class ProrationService {
  /**
   * Plan base costs in integer cents.
   */
  static getPlanBasePrice(planId) {
    if (planId === 'pro') return 2000; // $20.00 / month
    return 0; // Free plan
  }

  /**
   * Calculates fair mid-cycle proration without floating point errors.
   */
  static async calculateProration(tenantId, newPlanId, referenceTime = new Date()) {
    const sub = await SubscriptionModel.getActiveByTenantId(tenantId);
    if (!sub) throw new Error('No active subscription found');

    const start = new Date(sub.current_period_start).getTime();
    const end = new Date(sub.current_period_end).getTime();
    const refMs = new Date(referenceTime).getTime();

    // Guard within cycle boundaries
    const effectiveNow = Math.min(Math.max(refMs, start), end);

    const totalDurationMs = end - start;
    const remainingMs = end - effectiveNow;

    if (totalDurationMs <= 0) {
      throw new Error('Invalid billing cycle period duration');
    }

    const currentPlanCents = this.getPlanBasePrice(sub.plan_id);
    const newPlanCents = this.getPlanBasePrice(newPlanId);

    // Integer math with micro-units:
    const unusedCreditMicro = Math.floor((remainingMs / totalDurationMs) * currentPlanCents * 1000000);
    const newPlanProratedMicro = Math.floor((remainingMs / totalDurationMs) * newPlanCents * 1000000);

    const netChargeMicro = Math.max(0, newPlanProratedMicro - unusedCreditMicro);
    const proratedChargeCents = Math.round(netChargeMicro / 1000000);

    return {
      current_plan: sub.plan_id,
      new_plan: newPlanId,
      billing_period: {
        start: sub.current_period_start,
        end: sub.current_period_end,
      },
      cycle_total_days: +(totalDurationMs / (1000 * 60 * 60 * 24)).toFixed(1),
      remaining_days: +(remainingMs / (1000 * 60 * 60 * 24)).toFixed(1),
      remaining_ratio: +(remainingMs / totalDurationMs).toFixed(4),
      prorated_charge_cents: proratedChargeCents,
      prorated_charge_formatted: `$${(proratedChargeCents / 100).toFixed(2)}`,
    };
  }

  /**
   * Executes mid-cycle upgrade and updates subscription tier.
   */
  static async upgradeWithProration(tenantId, newPlanId) {
    const calculation = await this.calculateProration(tenantId, newPlanId);

    await db.query(
      `UPDATE subscriptions 
       SET plan_id = $1 
       WHERE tenant_id = $2 AND status = 'active'`,
      [newPlanId, tenantId]
    );

    return {
      success: true,
      new_plan: newPlanId,
      proration: calculation,
    };
  }
}

module.exports = ProrationService;
