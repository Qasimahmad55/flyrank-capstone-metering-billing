const ReconciliationJob = require('../jobs/reconciliationJob');

class JobController {
  static async runReconciliation(req, res) {
    try {
      const report = await ReconciliationJob.run();
      res.json({
        success: true,
        message: 'Reconciliation job executed',
        report,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = JobController;
