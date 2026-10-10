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

    // --- ALERTS LOGIC (80% and 100%) ---
    this.checkAndTriggerAlerts(tenantId, sub, currentUsage.api_call, newApiTotal, 'API Calls');
    this.checkAndTriggerAlerts(tenantId, sub, currentUsage.ai_tokens, newTokenTotal, 'AI Tokens');

    // --- OVERAGE LOGIC ---
    const isPro = sub.plan_id === 'pro';

    if (newApiTotal > sub.api_call_limit) {
      if (!isPro) {
        return { allowed: false, status: 429, message: \`API call quota exceeded. Limit: \${sub.api_call_limit}, Requested total: \${newApiTotal}\` };
      }
      // If Pro, they are allowed to go into overage
    }

    if (newTokenTotal > sub.ai_token_limit) {
      if (!isPro) {
        return { allowed: false, status: 429, message: \`AI token quota exceeded. Limit: \${sub.ai_token_limit}, Requested total: \${newTokenTotal}\` };
      }
    }

    return { allowed: true };
  }

  static checkAndTriggerAlerts(tenantId, sub, currentTotal, newTotal, resourceName) {
    const limit = resourceName === 'API Calls' ? sub.api_call_limit : sub.ai_token_limit;
    if (limit === 0) return;

    const currentPercent = currentTotal / limit;
    const newPercent = newTotal / limit;

    // Crossed 80% threshold
    if (currentPercent < 0.8 && newPercent >= 0.8) {
      console.log(\`[ALERT] Tenant \${tenantId} has reached 80% of their \${resourceName} quota.\`);
      // In a real system, you would enqueue a job to send an email alert here.
    }

    // Crossed 100% threshold
    if (currentPercent < 1.0 && newPercent >= 1.0) {
      console.log(\`[ALERT] Tenant \${tenantId} has reached 100% of their \${resourceName} quota.\`);
    }
  }
}

module.exports = QuotaService;
