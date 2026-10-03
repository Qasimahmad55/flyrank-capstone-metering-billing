const TenantModel = require('../models/tenantModel');
const db = require('../db');

class TenantService {
  static async getAllTenants() {
    return await TenantModel.getAll();
  }

  static async getTenantById(id) {
    return await TenantModel.getById(id);
  }

  static async createTenant({ name }) {
    // In a real scenario, you'd create a Stripe customer here too
    const tenant = await TenantModel.create({ name });
    
    // Assign free plan by default
    await db.query(
      `INSERT INTO subscriptions (tenant_id, plan_id, current_period_start, current_period_end) 
       VALUES ($1, $2, current_timestamp, current_timestamp + interval '1 month')`,
      [tenant.id, 'free']
    );

    return tenant;
  }
}

module.exports = TenantService;
