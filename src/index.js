const express = require('express');
const config = require('./config');
const planRoutes = require('./routes/planRoutes');
const tenantRoutes = require('./routes/tenantRoutes');

const app = express();

app.use(express.json());

app.use('/api/plans', planRoutes);
app.use('/api/tenants', tenantRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(config.port, () => {
  console.log(\`Server is running on port \${config.port}\`);
});
