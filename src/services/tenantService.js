const TenantModel = require('../models/tenantModel');
const PlanService = require('./planService');
const db = require('../db');

class TenantService {
  static async getAllTenants() {
    return await TenantModel.getAll();
  }

  static async getTenantById(id) {
    return await TenantModel.getById(id);
  }

  static async createTenant({ name }) {
    // Ensure default plans exist so foreign key constraint is always satisfied
    await PlanService.seedDefaultPlans();

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
