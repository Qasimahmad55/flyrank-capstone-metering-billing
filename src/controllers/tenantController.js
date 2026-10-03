const TenantService = require('../services/tenantService');

class TenantController {
  static async getAllTenants(req, res) {
    try {
      const tenants = await TenantService.getAllTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createTenant(req, res) {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      const tenant = await TenantService.createTenant({ name });
      res.status(201).json(tenant);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = TenantController;
