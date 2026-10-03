const db = require('../db');

class PlanModel {
  static async getAll() {
    const { rows } = await db.query('SELECT * FROM plans');
    return rows;
  }

  static async getById(id) {
    const { rows } = await db.query('SELECT * FROM plans WHERE id = $1', [id]);
    return rows[0];
  }

  static async create({ id, name, api_call_limit, ai_token_limit }) {
    const { rows } = await db.query(
      `INSERT INTO plans (id, name, api_call_limit, ai_token_limit) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, name, api_call_limit, ai_token_limit]
    );
    return rows[0];
  }
}

module.exports = PlanModel;
