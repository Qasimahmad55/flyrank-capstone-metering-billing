const request = require('supertest');
const app = require('../src/index');
const db = require('../src/db');
const { v4: uuidv4 } = require('uuid');

describe('Billing & Metering Engine Integration Tests', () => {
  let tenantId;

  // Helper to create a new isolated tenant for a test
  const createTestTenant = async () => {
    const res = await request(app)
      .post('/api/tenants')
      .send({ name: `Test Tenant ${uuidv4()}` });
    return res.body.id;
  };

  beforeAll(async () => {
    // Ensure plans exist
    await request(app).post('/api/plans/seed');
  });

  afterAll(async () => {
    // Close the DB pool so Jest exits cleanly
    await db.pool.end();
  });

  describe('1. Idempotent Usage Tracking', () => {
    it('should perfectly deduplicate requests with the same idempotency key', async () => {
      tenantId = await createTestTenant();
      const idemKey = uuidv4();

      // First Request
      const res1 = await request(app)
        .post('/api/metering/generate')
        .set('x-tenant-id', tenantId)
        .set('x-idempotency-key', idemKey)
        .send({ prompt: 'test' });
      
      expect(res1.status).toBe(200);
      expect(res1.body.metering.api_call_status).toBe('recorded');

      // Second Request (Duplicate)
      const res2 = await request(app)
        .post('/api/metering/generate')
        .set('x-tenant-id', tenantId)
        .set('x-idempotency-key', idemKey)
        .send({ prompt: 'test' });
      
      expect(res2.status).toBe(200);
      expect(res2.body.metering.api_call_status).toBe('already_recorded');
    });
  });

  describe('2. Quota Boundary Honesty', () => {
    it('should reject requests that exceed the 1000 API call Free plan limit', async () => {
      tenantId = await createTestTenant();

      // We cheat and directly inject 1000 usage events to reach the exact boundary quickly
      await db.query(
        `INSERT INTO usage_events (tenant_id, idempotency_key, type, quantity) 
         VALUES ($1, $2, 'api_call', 1000)`,
        [tenantId, uuidv4()]
      );

      // The next request should be 1001 and thus fail
      const res = await request(app)
        .post('/api/metering/generate')
        .set('x-tenant-id', tenantId)
        .set('x-idempotency-key', uuidv4())
        .send({ prompt: 'Boundary break' });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('API call quota exceeded');
    });
  });

  describe('3. Stripe Webhook Security', () => {
    it('should return 400 for a webhook request with a missing or forged signature', async () => {
      const res = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 't=123,v1=forged_signature')
        .send(JSON.stringify({ type: 'checkout.session.completed', id: 'evt_test' }));

      // Without a valid secret/signature, constructEvent throws an error resulting in 400
      expect(res.status).toBe(400);
      expect(res.text).toContain('Webhook Error');
    });
  });

  describe('4. Complex Token Money Math', () => {
    it('should accurately calculate the micro-cent pricing for mixed AI tokens', async () => {
      tenantId = await createTestTenant();

      // Generate a payload of exactly 1M of each token type
      await request(app)
        .post('/api/metering/generate')
        .set('x-tenant-id', tenantId)
        .set('x-idempotency-key', uuidv4())
        .send({
          prompt: 'Calculate my bill',
          simulate_tokens: {
            fresh_input: 1000000,
            cached_input: 1000000,
            output: 1000000,
            reasoning: 1000000
          }
        });

      // Fetch the usage rollup
      const res = await request(app)
        .get('/api/usage')
        .set('x-tenant-id', tenantId);

      expect(res.status).toBe(200);
      // Math: (350 * 1M) + (175 * 1M) + (1050 * 1M) + (1050 * 1M) = 2,625,000,000 micro-cents
      // Floor(2625000000 / 1000000) = 2625 cents ($26.25)
      expect(res.body.base_cost_cents).toBe(2625);
      expect(res.body.projected_overage_cents).toBeDefined();
      
      // Verify detailed token tracking exists
      expect(res.body.detailed_tokens.ai_fresh_input).toBe(1000000);
      expect(res.body.detailed_tokens.ai_reasoning).toBe(1000000);
    });
  });

  describe('5. Monthly Statement & Invoicing', () => {
    it('should generate an itemized invoice statement with detailed line items', async () => {
      tenantId = await createTestTenant();

      // Record some usage
      await request(app)
        .post('/api/metering/generate')
        .set('x-tenant-id', tenantId)
        .set('x-idempotency-key', uuidv4())
        .send({
          prompt: 'Invoice item generation',
          simulate_tokens: { fresh_input: 100000, output: 50000 }
        });

      const res = await request(app)
        .get('/api/invoices/current')
        .set('x-tenant-id', tenantId);

      expect(res.status).toBe(200);
      expect(res.body.statement_id).toMatch(/^INV-/);
      expect(res.body.line_items.length).toBeGreaterThan(0);
      expect(res.body.total_formatted).toBeDefined();
    });
  });

  describe('6. Mid-Cycle Proration Engine', () => {
    it('should accurately calculate mid-cycle proration without floating point errors', async () => {
      tenantId = await createTestTenant();

      // Retrieve tenant subscription to find middle of cycle
      const subRes = await db.query('SELECT * FROM subscriptions WHERE tenant_id = $1', [tenantId]);
      const sub = subRes.rows[0];
      const startMs = new Date(sub.current_period_start).getTime();
      const endMs = new Date(sub.current_period_end).getTime();
      const midPoint = new Date(startMs + (endMs - startMs) / 2);

      // Request a preview at the exact midpoint
      const previewRes = await request(app)
        .post('/api/subscriptions/preview-proration')
        .set('x-tenant-id', tenantId)
        .send({
          new_plan_id: 'pro',
          simulated_date: midPoint.toISOString(),
        });

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.current_plan).toBe('free');
      expect(previewRes.body.new_plan).toBe('pro');
      // Pro is $20.00 (2000 cents). Half cycle remaining should charge $10.00 (1000 cents)
      expect(previewRes.body.prorated_charge_cents).toBe(1000);
      expect(previewRes.body.prorated_charge_formatted).toBe('$10.00');

      // Now execute the actual upgrade
      const upgradeRes = await request(app)
        .post('/api/subscriptions/upgrade')
        .set('x-tenant-id', tenantId)
        .send({ new_plan_id: 'pro' });

      expect(upgradeRes.status).toBe(200);
      expect(upgradeRes.body.success).toBe(true);

      // Verify the subscription in database was updated
      const updatedSub = await db.query('SELECT * FROM subscriptions WHERE tenant_id = $1', [tenantId]);
      expect(updatedSub.rows[0].plan_id).toBe('pro');
    });
  });
});
