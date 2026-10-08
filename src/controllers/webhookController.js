const Stripe = require('stripe');
const config = require('../config');
const db = require('../db');

// Initialize Stripe directly here for webhook verification
const stripe = config.stripeSecretKey ? Stripe(config.stripeSecretKey) : null;

class WebhookController {
  static async handleStripeWebhook(req, res) {
    if (!stripe || !config.stripeWebhookSecret) {
      return res.status(500).send('Stripe is not configured.');
    }

    const signature = req.headers['stripe-signature'];
    let event;

    // 1. Verify the webhook signature (Probe 4)
    try {
      // req.body must be the raw buffer, which we will configure in Express
      event = stripe.webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(\`Webhook Error: \${err.message}\`);
    }

    // 2. Deduplicate the event
    try {
      // We attempt to insert the event ID. If it violates the PK constraint, it's a duplicate.
      await db.query(
        'INSERT INTO webhook_events (id, type) VALUES ($1, $2)',
        [event.id, event.type]
      );
    } catch (err) {
      if (err.code === '23505') {
        // Unique violation: We already processed this event. Return 200 immediately.
        console.log(\`Webhook \${event.id} deduplicated.\`);
        return res.status(200).send('Event already processed.');
      }
      return res.status(500).send('Database error during deduplication.');
    }

    // 3. Process specific Stripe events
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const tenantId = session.client_reference_id;
          const stripeSubscriptionId = session.subscription;

          if (tenantId) {
            // Upgrade tenant to Pro (Probe 3)
            await db.query(
              \`UPDATE subscriptions 
               SET plan_id = 'pro', stripe_subscription_id = $1, status = 'active'
               WHERE tenant_id = $2\`,
              [stripeSubscriptionId, tenantId]
            );
          }
          break;
        }
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const status = subscription.status; // e.g., 'active', 'past_due', 'canceled'
          
          await db.query(
            \`UPDATE subscriptions 
             SET status = $1 
             WHERE stripe_subscription_id = $2\`,
            [status, subscription.id]
          );
          break;
        }
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          // Mark as canceled or downgrade to free
          await db.query(
            \`UPDATE subscriptions 
             SET status = 'canceled' 
             WHERE stripe_subscription_id = $1\`,
            [subscription.id]
          );
          break;
        }
        default:
          console.log(\`Unhandled event type \${event.type}\`);
      }

      // 4. Return a 200 response to acknowledge receipt
      res.status(200).send({ received: true });
    } catch (err) {
      console.error('Error processing webhook:', err);
      // We return 500 so Stripe knows to retry if our business logic failed
      res.status(500).send('Webhook handler error.');
    }
  }
}

module.exports = WebhookController;
