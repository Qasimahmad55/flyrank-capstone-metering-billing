const db = require('../db');

class TenantModel {
  static async getAll() {
    const { rows } = await db.query('SELECT * FROM tenants');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT * FROM tenants WHERE id = $1', [id]);
    return rows[0];
  }

  static async create({ name, stripe_customer_id = null }) {
    const { rows } = await db.query(
      `INSERT INTO tenants (name, stripe_customer_id) 
       VALUES ($1, $2) RETURNING *`,
      [name, stripe_customer_id]
    );
    return rows[0];
  }
}

module.exports = TenantModel;
