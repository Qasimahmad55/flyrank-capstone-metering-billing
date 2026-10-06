const SubscriptionModel = require('../models/subscriptionModel');
const UsageEventModel = require('../models/usageEventModel');

class QuotaService {
  static async checkQuota(tenantId, requestedApiCalls, requestedTokens) {
    const sub = await SubscriptionModel.getActiveByTenantId(tenantId);

    if (!sub) {
      return { allowed: false, status: 402, message: 'No subscription found for tenant. Please upgrade or subscribe.' };
    }

    if (sub.status !== 'active') {
      return { allowed: false, status: 402, message: 'Subscription is inactive or payment required.' };
    }

    const currentUsage = await UsageEventModel.getCurrentUsage(
      tenantId,
      sub.current_period_start,
      sub.current_period_end
    );

    const newApiTotal = currentUsage.api_call + requestedApiCalls;
    const newTokenTotal = currentUsage.ai_tokens + requestedTokens;

    if (newApiTotal > sub.api_call_limit) {
      return { allowed: false, status: 429, message: `API call quota exceeded. Limit: ${sub.api_call_limit}, Requested total: ${newApiTotal}` };
    }

    if (newTokenTotal > sub.ai_token_limit) {
      return { allowed: false, status: 429, message: `AI token quota exceeded. Limit: ${sub.ai_token_limit}, Requested total: ${newTokenTotal}` };
    }

    return { allowed: true };
  }
}

module.exports = QuotaService;
