module.exports = {
  // We store money as micro-cents to avoid float precision issues.
  // 1,000,000 micro-cents = 1 US Cent.
  // Example based on $3.50 per 1M input tokens = 350 cents per 1M = 350 micro-cents per token.
  COST_PER_TOKEN_MICRO_CENTS: {
    'ai_fresh_input': 350,   // $3.50 per 1M tokens
    'ai_cached_input': 175,  // Cached input is cheaper ($1.75 per 1M tokens)
    'ai_output': 1050,       // $10.50 per 1M tokens
    'ai_reasoning': 1050,    // Reasoning tokens count exactly as output tokens
    'api_call': 0            // Base API calls are included in the plan subscription
  },
  
  // Overage fees for Pro plan users
  OVERAGE_RATES_MICRO_CENTS: {
    'api_call': 5000,        // $0.05 (5,000 micro-cents) per API call over the limit
    'ai_tokens': 10000       // $10.00 (10,000 micro-cents) per 1M tokens over the limit, flat rate
  }
};
