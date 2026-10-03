const PlanModel = require('../models/planModel');

class PlanService {
  static async getAllPlans() {
    return await PlanModel.getAll();
  }

  static async getPlanById(id) {
    return await PlanModel.getById(id);
  }

  static async seedDefaultPlans() {
    // Check if free exists
    let freePlan = await PlanModel.getById('free');
    if (!freePlan) {
      freePlan = await PlanModel.create({
        id: 'free',
        name: 'Free Plan',
        api_call_limit: 1000,
        ai_token_limit: 100000,
      });
    }

    let proPlan = await PlanModel.getById('pro');
    if (!proPlan) {
      proPlan = await PlanModel.create({
        id: 'pro',
        name: 'Pro Plan',
        api_call_limit: 10000,
        ai_token_limit: 1000000,
      });
    }

    return { freePlan, proPlan };
  }
}

module.exports = PlanService;
