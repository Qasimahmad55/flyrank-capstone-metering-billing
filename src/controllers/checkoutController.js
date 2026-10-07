const StripeService = require('../services/stripeService');
const TenantModel = require('../models/tenantModel');
const config = require('../config');
const db = require('../db');

class CheckoutController {
  static async createSession(req, res) {
    try {
      const tenantId = req.headers['x-tenant-id'];
      if (!tenantId) return res.status(400).json({ error: 'x-tenant-id header is required' });

      // Fetch the tenant
      const tenant = await TenantModel.getById(tenantId);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

      // Ensure tenant has a Stripe Customer ID
      let customerId = tenant.stripe_customer_id;
      if (!customerId) {
        const customer = await StripeService.createCustomer(tenant.name, tenantId);
        customerId = customer.id;
        // Update DB
        await db.query('UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2', [customerId, tenantId]);
      }

      // Ensure we have a Pro price ID configured
      if (!config.stripeProPriceId || config.stripeProPriceId === 'price_placeholder') {
        return res.status(500).json({ error: 'STRIPE_PRO_PRICE_ID is not configured in environment variables' });
      }

      // Create checkout session
      const session = await StripeService.createCheckoutSession(customerId, config.stripeProPriceId, tenantId);

      // Return the URL so the client can redirect the user
      res.json({ url: session.url });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = CheckoutController;
