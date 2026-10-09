# BUILDLOG.md

**AI Usage Disclosure**

I paired with Antigravity AI (Gemini) as a pair programmer to build this system. 

- **Where AI helped:** The AI provided the initial scaffolding for the Express server, PostgreSQL connection pooling, and the Docker setup. It also helped translate the billing requirements into exact database queries (like the `SUM(quantity) GROUP BY type` usage aggregation). It generated bash scripts to automate testing the edge cases for the acceptance probes.
- **Where it was wrong/needed correction:** During the webhook implementation, the AI initially mounted the Express JSON parser globally before the webhook route, which destroyed the raw Buffer body required for Stripe's signature verification. We had to correct the route mounting order to fix `stripe.webhooks.constructEvent`.
- **What I changed/own:** I fully own the architecture layout and the specific implementation of the idempotency logic in the database (using `23505` unique constraints). I verified and tested all the math logic manually to ensure no floating-point errors could occur by using micro-cents.
