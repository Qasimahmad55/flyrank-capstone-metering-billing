const express = require('express');
const config = require('./config');
const planRoutes = require('./routes/planRoutes');
const tenantRoutes = require('./routes/tenantRoutes');

const app = express();

// Webhooks must be mounted BEFORE express.json() so they can receive the raw Buffer body
app.use('/api/webhooks', require('./routes/webhookRoutes'));

app.use(express.json());

app.use('/api/plans', planRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/metering', require('./routes/meteringRoutes'));
app.use('/api/checkout', require('./routes/checkoutRoutes'));
app.use('/api/usage', require('./routes/usageRoutes'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(config.port, () => {
  console.log(\`Server is running on port \${config.port}\`);
});
