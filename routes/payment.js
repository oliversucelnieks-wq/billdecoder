const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout', async (req, res) => {
  try {
    const { plan } = req.body;
    const prices = {
      single: { amount: 499, name: 'Single Bill Analysis', description: 'One medical bill analysis + dispute letter' },
      pro: { amount: 999, name: 'Pro Monthly', description: 'Unlimited analyses for 30 days' },
      family: { amount: 1999, name: 'Family Monthly', description: 'Cover your whole family for 30 days' }
    };
    const selected = prices[plan] || prices.single;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: selected.name, description: selected.description }, unit_amount: selected.amount }, quantity: 1 }],
      mode: 'payment',
      success_url: (process.env.APP_URL || 'http://localhost:3000') + '/?payment=success',
      cancel_url: (process.env.APP_URL || 'http://localhost:3000') + '/?payment=cancelled'
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Payment setup failed' });
  }
});

module.exports = router;