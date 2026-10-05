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
        // Return duplicate true, so service knows it was already processed
        return { event: null, isDuplicate: true };
      }
      throw error;
    }
  }
}

module.exports = UsageEventModel;
