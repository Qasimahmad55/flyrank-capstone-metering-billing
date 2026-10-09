# Usage Metering & Billing Engine

This capstone implements a robust, idempotent backend billing engine for a SaaS product. It tracks API calls and AI tokens, enforces tier quotas, calculates precise costs based on token types, and synchronizes subscription states using Stripe test mode webhooks.

## Architecture Diagram

```mermaid
flowchart TD
    Client[Client App] -->|POST /generate| API[Metering API]
    API --> |1. Check Quota| QS[Quota Service]
    QS --> DB[(PostgreSQL)]
    API --> |2. Record Usage (Idempotent)| DB
    
    Client -->|GET /usage| UsageAPI[Usage API]
    UsageAPI --> |Rollup & Math| DB
    
    Client -->|POST /checkout| Checkout[Checkout API]
    Checkout --> Stripe[(Stripe)]
    
    Stripe -->|Webhook| WebhookAPI[Webhook Handler]
    WebhookAPI --> |Verify & Deduplicate| DB
    WebhookAPI --> |Update Subscription| DB
```

## Setup & Run Instructions

**Prerequisites**: Docker, Node.js v18+, Stripe CLI.

1. **Environment Variables**:
   Copy the example file and fill in your Stripe keys:
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   *(Ensure \`STRIPE_PRO_PRICE_ID\` is set to a valid recurring test price ID from your Stripe dashboard).*

2. **Boot the System**:
   Start the database, run migrations, and start the development server:
   \`\`\`bash
   docker-compose up -d
   npm run migrate up
   npm run dev
   \`\`\`

3. **Seed the Database**:
   Seed the default "Free" and "Pro" plans:
   \`\`\`bash
   curl -X POST http://localhost:3000/api/plans/seed
   \`\`\`

4. **Stripe Webhooks (Local Forwarding)**:
   In a new terminal, use the Stripe CLI to forward events:
   \`\`\`bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   \`\`\`
   *(Copy the webhook secret printed in the terminal into your \`.env\` file as \`STRIPE_WEBHOOK_SECRET\` and restart the server).*

## Limitations & Explicit Non-Goals
- **Live Payments**: This system operates exclusively in Stripe Test Mode. Real credit card handling and live transactions are out of scope.
- **Invoice Generation / Proration**: Currently, the system rolls up costs dynamically. Hardcoded invoices and complex mid-cycle proration math are not implemented in the core logic.
- **Distributed Caching**: Quotas are checked directly against PostgreSQL. In a massive scale environment, Redis or a similar in-memory datastore would be placed in front of the DB for quota enforcement.
