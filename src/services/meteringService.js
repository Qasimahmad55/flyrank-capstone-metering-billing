const UsageEventModel = require('../models/usageEventModel');

class MeteringService {
  /**
   * Records usage for a tenant idempotently.
   * Day 4 will add quota checks here.
   */
  static async recordUsage(tenantId, idempotencyKey, type, quantity) {
    const result = await UsageEventModel.recordEvent({
      tenant_id: tenantId,
      idempotency_key: idempotencyKey,
      type,
      quantity
    });

    if (result.isDuplicate) {
      return { status: 'already_recorded', message: 'Event ignored due to duplicate idempotency key' };
    }

    return { status: 'recorded', event: result.event };
  }
}

module.exports = MeteringService;
