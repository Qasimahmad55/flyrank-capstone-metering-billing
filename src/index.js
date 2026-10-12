const express = require('express');
const config = require('./config');
const planRoutes = require('./routes/planRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const meteringRoutes = require('./routes/meteringRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const usageRoutes = require('./routes/usageRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const jobRoutes = require('./routes/jobRoutes');
const ReconciliationJob = require('./jobs/reconciliationJob');

const app = express();

// Webhooks must be mounted BEFORE express.json() so they can receive the raw Buffer body
app.use('/webhooks', webhookRoutes);
app.use('/api/webhooks', webhookRoutes);

app.use(express.json());

// Support standard paths as specified in capstone brief (/generate, /usage, /checkout)
app.use('/generate', meteringRoutes);
app.use('/usage', usageRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/plans', planRoutes);
app.use('/tenants', tenantRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/jobs', jobRoutes);

// Support API prefixed paths (/api/...)
app.use('/api/plans', planRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/metering', meteringRoutes);
app.use('/api/generate', meteringRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/jobs', jobRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);

    // Schedule nightly reconciliation background job (runs every 24 hours)
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    setInterval(() => {
      console.log('[BACKGROUND SCHEDULER] Triggering scheduled nightly reconciliation...');
      ReconciliationJob.run().catch((err) =>
        console.error('[BACKGROUND SCHEDULER ERROR]', err)
      );
    }, TWENTY_FOUR_HOURS);
  });
}

module.exports = app;
