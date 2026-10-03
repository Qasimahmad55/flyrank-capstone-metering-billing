const PlanService = require('../services/planService');

class PlanController {
  static async getAllPlans(req, res) {
    try {
      const plans = await PlanService.getAllPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async seed(req, res) {
    try {
      const plans = await PlanService.seedDefaultPlans();
      res.json({ message: 'Plans seeded successfully', plans });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = PlanController;
