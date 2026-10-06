const db = require('../db');

class SubscriptionModel {
  static async getActiveByTenantId(tenantId) {
    const { rows } = await db.query(
      `SELECT s.*, p.api_call_limit, p.ai_token_limit 
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.tenant_id = $1
       ORDER BY s.current_period_end DESC
       LIMIT 1`,
      [tenantId]
    );
    return rows[0];
  }
}

module.exports = SubscriptionModel;
