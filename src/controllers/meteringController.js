const MeteringService = require('../services/meteringService');
const QuotaService = require('../services/quotaService');

class MeteringController {
  static async generate(req, res) {
    try {
      const tenantId = req.headers['x-tenant-id'];
      const idempotencyKey = req.headers['x-idempotency-key'];

      if (!tenantId || !idempotencyKey) {
        return res.status(400).json({ error: 'x-tenant-id and x-idempotency-key headers are required' });
      }

      // Simulated generative action workload
      const { prompt, simulate_tokens } = req.body;
      const totalTokens = simulate_tokens ?
        (simulate_tokens.cached_input || 0) +
        (simulate_tokens.fresh_input || 0) +
        (simulate_tokens.output || 0) +
        (simulate_tokens.reasoning || 0) : 100; // default 100 for dummy calls

      // --- QUOTA ENFORCEMENT BOUNDARY ---
      const quotaCheck = await QuotaService.checkQuota(tenantId, 1, totalTokens);
      if (!quotaCheck.allowed) {
        return res.status(quotaCheck.status).json({ error: quotaCheck.message });
      }

      // Record API call usage
      const apiCallResult = await MeteringService.recordUsage(
        tenantId,
        `${idempotencyKey}-api`,
        'api_call',
        1
      );

      // Record AI token usage (Detailed breakdown for Money Math)
      let tokenStatuses = {};
      if (simulate_tokens) {
        if (simulate_tokens.fresh_input) {
          const res = await MeteringService.recordUsage(tenantId, `${idempotencyKey}-fresh`, 'ai_fresh_input', simulate_tokens.fresh_input);
          tokenStatuses.fresh = res.status;
        }
        if (simulate_tokens.cached_input) {
          const res = await MeteringService.recordUsage(tenantId, `${idempotencyKey}-cached`, 'ai_cached_input', simulate_tokens.cached_input);
          tokenStatuses.cached = res.status;
        }
        if (simulate_tokens.output) {
          const res = await MeteringService.recordUsage(tenantId, `${idempotencyKey}-output`, 'ai_output', simulate_tokens.output);
          tokenStatuses.output = res.status;
        }
        if (simulate_tokens.reasoning) {
          const res = await MeteringService.recordUsage(tenantId, `${idempotencyKey}-reasoning`, 'ai_reasoning', simulate_tokens.reasoning);
          tokenStatuses.reasoning = res.status;
        }
      } else {
        const res = await MeteringService.recordUsage(tenantId, `${idempotencyKey}-fresh`, 'ai_fresh_input', 100);
        tokenStatuses.fresh = res.status;
      }

      // We successfully return a dummy generative response
      res.status(200).json({
        response: `Simulated response for prompt: "${prompt}"`,
        metering: {
          api_call_status: apiCallResult.status,
          token_status: tokenStatuses
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = MeteringController;
