const UsageEventModel = require('../models/usageEventModel');
const SubscriptionModel = require('../models/subscriptionModel');
const TenantModel = require('../models/tenantModel');
const pricing = require('../config/pricing');

class InvoiceService {
  static async generateMonthlyStatement(tenantId) {
    const tenant = await TenantModel.getById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const sub = await SubscriptionModel.getActiveByTenantId(tenantId);
    if (!sub) throw new Error('No active subscription found for tenant');

    const usage = await UsageEventModel.getCurrentUsage(
      tenantId,
      sub.current_period_start,
      sub.current_period_end
    );

    const lineItems = [];
    let totalCents = 0;

    // 1. Base Subscription Charge
    const isPro = sub.plan_id === 'pro';
    const baseSubscriptionCents = isPro ? 2000 : 0; // $20.00 for Pro, $0 for Free
    lineItems.push({
      description: `${isPro ? 'Pro' : 'Free'} Plan Subscription`,
      quantity: 1,
      unit_cost_cents: baseSubscriptionCents,
      total_cents: baseSubscriptionCents,
    });
    totalCents += baseSubscriptionCents;

    // 2. Token Line Items
    const tokenDescriptions = {
      'ai_fresh_input': 'Fresh Input Tokens',
      'ai_cached_input': 'Cached Input Tokens (Discounted)',
      'ai_output': 'Output Tokens',
      'ai_reasoning': 'Reasoning Tokens (Billed as Output)',
    };

    for (const [type, description] of Object.entries(tokenDescriptions)) {
      const count = usage.detailed[type] || 0;
      if (count > 0) {
        const rateMicroCents = pricing.COST_PER_TOKEN_MICRO_CENTS[type] || 0;
        const lineItemCents = Math.floor((count * rateMicroCents) / 1000000);
        lineItems.push({
          description,
          quantity: count,
          unit_cost_micro_cents: rateMicroCents,
          total_cents: lineItemCents,
        });
        totalCents += lineItemCents;
      }
    }

    // 3. Overage Charges
    if (isPro) {
      const overageCalls = Math.max(0, usage.api_call - sub.api_call_limit);
      if (overageCalls > 0) {
        const overageCallCents = Math.floor((overageCalls * pricing.OVERAGE_RATES_MICRO_CENTS.api_call) / 1000000);
        lineItems.push({
          description: 'API Call Overage Fees',
          quantity: overageCalls,
          unit_cost_micro_cents: pricing.OVERAGE_RATES_MICRO_CENTS.api_call,
          total_cents: overageCallCents,
        });
        totalCents += overageCallCents;
      }

      const overageTokens = Math.max(0, usage.ai_tokens - sub.ai_token_limit);
      if (overageTokens > 0) {
        const overageTokenCents = Math.floor((overageTokens * pricing.OVERAGE_RATES_MICRO_CENTS.ai_tokens) / 1000000);
        lineItems.push({
          description: 'AI Token Overage Fees',
          quantity: overageTokens,
          unit_cost_micro_cents: pricing.OVERAGE_RATES_MICRO_CENTS.ai_tokens,
          total_cents: overageTokenCents,
        });
        totalCents += overageTokenCents;
      }
    }

    return {
      statement_id: `INV-${tenantId.slice(0, 8).toUpperCase()}-${Date.now()}`,
      tenant_name: tenant.name,
      tenant_id: tenant.id,
      billing_period: {
        start: sub.current_period_start,
        end: sub.current_period_end,
      },
      plan: sub.plan_id,
      line_items: lineItems,
      total_cents: totalCents,
      total_formatted: `$${(totalCents / 100).toFixed(2)}`,
    };
  }
}

module.exports = InvoiceService;
