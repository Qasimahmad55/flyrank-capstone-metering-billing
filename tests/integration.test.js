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
      .send({ name: \`Test Tenant \${uuidv4()}\` });
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
        \`INSERT INTO usage_events (tenant_id, idempotency_key, type, quantity) 
         VALUES ($1, $2, 'api_call', 1000)\`,
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
});
