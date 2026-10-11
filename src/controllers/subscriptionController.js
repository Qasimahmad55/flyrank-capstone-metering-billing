const ProrationService = require('../services/prorationService');

class SubscriptionController {
  static async previewProration(req, res) {
    try {
      const tenantId = req.headers['x-tenant-id'];
      const { new_plan_id, simulated_date } = req.body;

      if (!tenantId) return res.status(400).json({ error: 'x-tenant-id header is required' });
      if (!new_plan_id) return res.status(400).json({ error: 'new_plan_id is required' });

      const calculation = await ProrationService.calculateProration(
        tenantId,
        new_plan_id,
        simulated_date || new Date()
      );
      res.json(calculation);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async upgrade(req, res) {
    try {
      const tenantId = req.headers['x-tenant-id'];
      const { new_plan_id } = req.body;

      if (!tenantId) return res.status(400).json({ error: 'x-tenant-id header is required' });
      if (!new_plan_id) return res.status(400).json({ error: 'new_plan_id is required' });

      const result = await ProrationService.upgradeWithProration(tenantId, new_plan_id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = SubscriptionController;
