const UsageEventModel = require('../models/usageEventModel');
const SubscriptionModel = require('../models/subscriptionModel');
const pricing = require('../config/pricing');

class UsageController {
  static async getUsage(req, res) {
    try {
      const tenantId = req.headers['x-tenant-id'];
      if (!tenantId) return res.status(400).json({ error: 'x-tenant-id header is required' });

      const sub = await SubscriptionModel.getActiveByTenantId(tenantId);
      if (!sub) return res.status(404).json({ error: 'Subscription not found for tenant' });

      // Roll up all usage for the current billing period
      const usage = await UsageEventModel.getCurrentUsage(
        tenantId, 
        sub.current_period_start, 
        sub.current_period_end
      );

      // Execute Base Money Math
      let totalMicroCents = 0;
      for (const [type, quantity] of Object.entries(usage.detailed)) {
        const rate = pricing.COST_PER_TOKEN_MICRO_CENTS[type] || 0;
        totalMicroCents += rate * quantity;
      }
      
      const current_cost_cents = Math.floor(totalMicroCents / 1000000);

      // --- OVERAGE MATH ---
      let projected_overage_cents = 0;
      const isPro = sub.plan_id === 'pro';
      
      if (isPro) {
        const overageApiCalls = Math.max(0, usage.api_call - sub.api_call_limit);
        const overageAiTokens = Math.max(0, usage.ai_tokens - sub.ai_token_limit);
        
        const overageApiCents = Math.floor((overageApiCalls * pricing.OVERAGE_RATES_MICRO_CENTS.api_call) / 1000000);
        const overageAiCents = Math.floor((overageAiTokens * pricing.OVERAGE_RATES_MICRO_CENTS.ai_tokens) / 1000000);
        
        projected_overage_cents = overageApiCents + overageAiCents;
      }

      res.json({
        period_start: sub.current_period_start,
        period_end: sub.current_period_end,
        api_calls: {
          used: usage.api_call,
          limit: sub.api_call_limit
        },
        ai_tokens: {
          used: usage.ai_tokens,
          limit: sub.ai_token_limit
        },
        detailed_tokens: usage.detailed,
        base_cost_cents: current_cost_cents,
        projected_overage_cents,
        total_projected_cost_cents: current_cost_cents + projected_overage_cents
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = UsageController;
