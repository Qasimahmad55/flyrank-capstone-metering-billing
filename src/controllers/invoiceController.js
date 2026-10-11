const InvoiceService = require('../services/invoiceService');

class InvoiceController {
  static async getInvoice(req, res) {
    try {
      const tenantId = req.headers['x-tenant-id'];
      if (!tenantId) return res.status(400).json({ error: 'x-tenant-id header is required' });

      const statement = await InvoiceService.generateMonthlyStatement(tenantId);
      res.json(statement);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = InvoiceController;
