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

      // Execute Money Math
      let totalMicroCents = 0;
      for (const [type, quantity] of Object.entries(usage.detailed)) {
        const rate = pricing.COST_PER_TOKEN_MICRO_CENTS[type] || 0;
        totalMicroCents += rate * quantity;
      }
      
      // We store/present money as integers (cents). Micro-cents -> cents.
      const current_cost_cents = Math.floor(totalMicroCents / 1000000);

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
        current_cost_cents
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = UsageController;
