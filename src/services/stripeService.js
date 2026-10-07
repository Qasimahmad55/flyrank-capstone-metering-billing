const Stripe = require('stripe');
const config = require('../config');

// Initialize Stripe if key is provided (prevents crashing if not set up yet)
const stripe = config.stripeSecretKey ? Stripe(config.stripeSecretKey) : null;

class StripeService {
  /**
   * Creates a Stripe customer for a tenant.
   */
  static async createCustomer(tenantName, tenantId) {
    if (!stripe) throw new Error('Stripe is not configured');
    
    const customer = await stripe.customers.create({
      name: tenantName,
      metadata: { tenant_id: tenantId },
    });
    return customer;
  }

  /**
   * Creates a Checkout session to upgrade to Pro.
   */
  static async createCheckoutSession(customerId, priceId, tenantId) {
    if (!stripe) throw new Error('Stripe is not configured');

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // We pass the tenantId in client_reference_id to easily identify it in the webhook
      client_reference_id: tenantId,
      success_url: \`http://localhost:\${config.port}/success?session_id={CHECKOUT_SESSION_ID}\`,
      cancel_url: \`http://localhost:\${config.port}/cancel\`,
    });

    return session;
  }
}

module.exports = StripeService;
