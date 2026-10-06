const db = require('../db');

class UsageEventModel {
  static async recordEvent({ tenant_id, idempotency_key, type, quantity }) {
    try {
      const { rows } = await db.query(
        `INSERT INTO usage_events (tenant_id, idempotency_key, type, quantity) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [tenant_id, idempotency_key, type, quantity]
      );
      return { event: rows[0], isDuplicate: false };
    } catch (error) {
      // 23505 is the PostgreSQL error code for unique_violation
      if (error.code === '23505') {
        return { event: null, isDuplicate: true };
      }
      throw error;
    }
  }

  static async getCurrentUsage(tenantId, periodStart, periodEnd) {
    const { rows } = await db.query(
      `SELECT type, SUM(quantity) as total_used 
       FROM usage_events 
       WHERE tenant_id = $1 
         AND timestamp >= $2 
         AND timestamp <= $3 
       GROUP BY type`,
      [tenantId, periodStart, periodEnd]
    );
    
    const usage = { api_call: 0, ai_tokens: 0 };
    rows.forEach(row => {
      usage[row.type] = parseInt(row.total_used, 10) || 0;
    });
    return usage;
  }
}

module.exports = UsageEventModel;
