const express = require('express');
const Stripe = require('stripe');
const { query } = require('../config/database');
const { authenticateToken , requireRole} = require('../middleware/auth');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Process Stripe payment
router.post('/stripe', authenticateToken, async (req, res) => {
  try {
    const { sale_id, amount, currency = 'USD', payment_method_id } = req.body;

    if (!sale_id || !amount || !payment_method_id) {
      return res.status(400).json({ error: 'Sale ID, amount, and payment method required' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      payment_method: payment_method_id,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        sale_id: sale_id.toString(),
        user_id: req.user.id.toString()
      }
    });

    // Record payment in database
    const result = await query(
      `INSERT INTO payments 
       (sale_id, payment_method, amount, currency, stripe_payment_id, stripe_payment_intent_id, payment_status, metadata)
       VALUES ($1, 'card', $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        sale_id,
        amount,
        currency,
        payment_method_id,
        paymentIntent.id,
        paymentIntent.status,
        JSON.stringify({ charge_id: paymentIntent.latest_charge })
      ]
    );

    // Update sale status
    await query(
      'UPDATE sales SET payment_status = $1 WHERE id = $2',
      [paymentIntent.status === 'succeeded' ? 'completed' : 'pending', sale_id]
    );

    res.json({
      payment: result.rows[0],
      stripe_status: paymentIntent.status,
      client_secret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Stripe payment error:', error);
    res.status(500).json({ 
      error: error.message || 'Payment processing failed',
      type: error.type
    });
  }
});

// Record cash payment
router.post('/cash', authenticateToken, async (req, res) => {
  try {
    const { sale_id, amount, received_amount, change_amount } = req.body;

    if (!sale_id || !amount || !received_amount) {
      return res.status(400).json({ error: 'Sale ID, amount, and received amount required' });
    }

    const result = await query(
      `INSERT INTO payments 
       (sale_id, payment_method, amount, currency, payment_status, metadata)
       VALUES ($1, 'cash', $2, 'USD', 'completed', $3)
       RETURNING *`,
      [
        sale_id,
        amount,
        JSON.stringify({ 
          received_amount, 
          change_amount: change_amount || (received_amount - amount) 
        })
      ]
    );

    // Update sale status
    await query(
      'UPDATE sales SET payment_status = $1 WHERE id = $2',
      ['completed', sale_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Cash payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record QR payment
router.post('/qr', authenticateToken, async (req, res) => {
  try {
    const { sale_id, amount, qr_transaction_id, provider } = req.body;

    if (!sale_id || !amount || !qr_transaction_id) {
      return res.status(400).json({ error: 'Sale ID, amount, and QR transaction ID required' });
    }

    const result = await query(
      `INSERT INTO payments 
       (sale_id, payment_method, amount, currency, payment_status, metadata)
       VALUES ($1, 'qr', $2, 'USD', 'completed', $3)
       RETURNING *`,
      [
        sale_id,
        amount,
        JSON.stringify({ 
          qr_transaction_id, 
          provider: provider || 'local_qr',
          timestamp: new Date().toISOString()
        })
      ]
    );

    // Update sale status
    await query(
      'UPDATE sales SET payment_status = $1 WHERE id = $2',
      ['completed', sale_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('QR payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case 'payment_intent.succeeded':
      // Update payment status
      break;
    case 'payment_intent.payment_failed':
      // Handle failed payment
      break;
  }

  res.json({ received: true });
});

router.post('/refund', authenticateToken, requireRole('admin'), async (req, res) => {
  const { payment_id, amount } = req.body;

  // Get payment record
  const payment = await query(
    'SELECT * FROM payments WHERE id = $1',
    [payment_id]
  );

  // Create refund in Stripe
  const refund = await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
    amount: amount ? Math.round(amount * 100) : undefined,
  });

  // Update sale status
  await query(
    'UPDATE sales SET payment_status = $1 WHERE id = $2',
    ['refunded', payment.sale_id]
  );

  return refund;
});

// Get payment details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM payments WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;