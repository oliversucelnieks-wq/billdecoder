# BillDecoder

AI-powered medical bill error detector. Upload any medical bill and get a full analysis in 60 seconds.

## What it does
- Reads every billing code in your medical bill
- Compares charges to Medicare rates
- Flags errors, duplicates, and overcharges
- Generates a ready-to-send dispute letter

## Stack
- **Backend:** Node.js + Express
- **AI:** Claude claude-sonnet-4-6 (Anthropic)
- **Payments:** Stripe
- **Hosting:** Render

## Local Setup

```bash
git clone https://github.com/oliversucelnieks-wq/billdecoder.git
cd billdecoder
npm install
cp .env.example .env
# Fill in your API keys in .env
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| ANTHROPIC_API_KEY | From console.anthropic.com |
| STRIPE_SECRET_KEY | From dashboard.stripe.com |
| APP_URL | Your Render deployment URL |

## Deploy to Render

1. Push this repo to GitHub
2. Go to render.com → New Web Service
3. Connect your GitHub repo
4. Add the 3 environment variables above
5. Build: `npm install` · Start: `npm start`
6. Deploy

## Disclaimer
BillDecoder provides informational analysis only. Not legal or medical advice.