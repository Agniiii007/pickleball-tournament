const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Razorpay Instance (will use dummy values for local testing)
const razorpay = process.env.RAZORPAY_KEY_ID ? new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
}) : null;

// Google Sheets Setup
let sheets = null;
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('Google Sheets setup error:', error.message);
  }
}

// Pricing Configuration
const PRICING = {
  u12_girls: { Singles: 850, Doubles: 1500 },
  u12_boys: { Singles: 850, Doubles: 1500 },
  u19_girls: { Singles: 850, Doubles: 1500 },
  u19_boys: { Singles: 850, Doubles: 1500 },
  open_beginners_men: { Singles: 850, Doubles: 1500 },
  open_beginners_women: { Singles: 850, Doubles: 1500 },
  open_mixed: { Mixed: 1500 },
  open_men_adv: { Singles: 850, Doubles: 1500, Mixed: 1500 },
  '35plus_men': { Singles: 850, Doubles: 1500, Mixed: 1500 },
  '35plus_women': { Singles: 850, Doubles: 1500, Mixed: 1500 },
  '50plus_men': { Singles: 850, Doubles: 1500, Mixed: 1500 },
  '50plus_women': { Singles: 850, Doubles: 1500, Mixed: 1500 },
};

// Calculate Total Server-Side
function calculateTotal(selectedEvents) {
  let total = 0;
  selectedEvents.forEach(event => {
    const parts = event.split('_');
    const eventTypeFromKey = parts[parts.length - 1];
    const catIdFromKey = parts.slice(0, -1).join('_');
    if (PRICING[catIdFromKey] && PRICING[catIdFromKey][eventTypeFromKey]) {
      total += PRICING[catIdFromKey][eventTypeFromKey];
    }
  });
  return total;
}

// Write to Google Sheets
async function writeToSheet(data) {
  if (!sheets || !process.env.GOOGLE_SHEET_ID) {
    console.log('⚠️  Google Sheets not configured - skipping write');
    return;
  }

  try {
    const timestamp = new Date().toISOString();
    const eventsString = data.selectedEvents.join(', ');
    
    const partners = data.selectedEvents
      .map(e => {
        const partner = data.partners[e];
        return partner ? `${partner.name} (${partner.phone}, ${partner.email})` : '';
      })
      .filter(p => p)
      .join('; ');

    const values = [[
      timestamp,
      data.name,
      data.email,
      data.phone,
      data.address,
      eventsString,
      partners,
      data.total,
      data.paymentRef,
      'Completed'
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:J',
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });

    console.log('✅ Written to Google Sheets');
  } catch (error) {
    console.error('❌ Google Sheets Error:', error.message);
    throw error;
  }
}

// Routes

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      razorpay: !!razorpay,
      sheets: !!sheets
    }
  });
});

// Create Order
app.post('/api/register', async (req, res) => {
  try {
    console.log('=== ORDER CREATION START ===');
    const { name, email, phone, address, selectedEvents, partners } = req.body;

    // Validation
    if (!name || !email || !phone || !address || !selectedEvents || selectedEvents.length === 0) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (selectedEvents.length > 3) {
      console.log('❌ Validation failed: Too many events');
      return res.status(400).json({ error: 'Maximum 3 events allowed' });
    }

    // Calculate total server-side
    const calculatedTotal = calculateTotal(selectedEvents);
    console.log('Calculated total:', calculatedTotal);

    // Demo mode - return mock order for testing
    if (!razorpay) {
      console.log('⚠️  Demo mode - returning mock order');
      return res.json({
        orderId: 'order_demo_' + Date.now(),
        amount: calculatedTotal,
        currency: 'INR',
        keyId: 'rzp_test_demo',
        demo: true
      });
    }

    // Real Razorpay Order
    console.log('Creating Razorpay order...');
    const order = await razorpay.orders.create({
      amount: calculatedTotal * 100,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { name, email, phone },
    });

    console.log('✅ Order created:', order.id);
    console.log('=== ORDER CREATION END ===');

    res.json({
      orderId: order.id,
      amount: calculatedTotal,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('❌ Order Creation Error:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

// Verify Payment
app.post('/api/verify-payment', async (req, res) => {
  try {
    console.log('=== PAYMENT VERIFICATION START ===');
    console.log('Request body keys:', Object.keys(req.body));
    
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      formData,
    } = req.body;

    console.log('Order ID:', razorpay_order_id);
    console.log('Payment ID:', razorpay_payment_id);
    console.log('Signature received:', razorpay_signature ? 'Yes' : 'No');
    console.log('FormData received:', formData ? 'Yes' : 'No');

    // Demo mode
    if (!razorpay || (razorpay_order_id || '').includes('demo')) {
      console.log('⚠️  Demo mode - simulating successful payment');
      
      const mockPaymentId = 'pay_demo_' + Date.now();
      const registrationData = {
        ...formData,
        total: calculateTotal(formData.selectedEvents),
        paymentRef: mockPaymentId,
      };

      try {
        await writeToSheet(registrationData);
      } catch (e) {
        console.log('Sheets write failed (expected in demo):', e.message);
      }

      console.log('✅ Demo payment verification complete');
      console.log('=== PAYMENT VERIFICATION END ===');

      return res.json({
        success: true,
        registrationId: mockPaymentId,
        paymentRef: mockPaymentId,
        demo: true
      });
    }

    // Real payment verification
    console.log('Verifying real Razorpay payment...');
    console.log('Using Key Secret:', process.env.RAZORPAY_KEY_SECRET ? 'Present' : 'Missing');
    
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    console.log('Generated signature:', generatedSignature);
    console.log('Received signature:', razorpay_signature);
    console.log('Signatures match:', generatedSignature === razorpay_signature);

    if (generatedSignature !== razorpay_signature) {
      console.log('❌ Signature verification FAILED');
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    console.log('✅ Signature verification SUCCESS');

    const calculatedTotal = calculateTotal(formData.selectedEvents);
    
    const registrationData = {
      ...formData,
      total: calculatedTotal,
      paymentRef: razorpay_payment_id,
    };

    console.log('Writing to Google Sheets...');
    await writeToSheet(registrationData);

    console.log('✅ Payment verification successful');
    console.log('=== PAYMENT VERIFICATION END ===');

    res.json({
      success: true,
      registrationId: razorpay_payment_id,
      paymentRef: razorpay_payment_id,
    });
  } catch (error) {
    console.error('❌ Payment Verification Error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Payment verification failed', details: error.message });
  }
});

// Razorpay Webhook (Fallback)
app.post('/webhooks/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body.event;

    if (event === 'payment.captured') {
      console.log('✅ Webhook received: payment.captured');
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Admin Routes (Protected)
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Get All Registrations
app.get('/admin/registrations', adminAuth, async (req, res) => {
  try {
    const { search, export: exportCsv } = req.query;

    if (!sheets || !process.env.GOOGLE_SHEET_ID) {
      return res.status(503).json({ error: 'Google Sheets not configured' });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Registrations!A:J',
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    const data = rows.slice(1);

    let filteredData = data;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = data.filter(row =>
        row.some(cell => (cell || '').toLowerCase().includes(searchLower))
      );
    }

    if (exportCsv === 'true') {
      const csv = [headers, ...filteredData].map(row => row.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=registrations.csv');
      return res.send(csv);
    }

    res.json({
      headers,
      data: filteredData,
      total: filteredData.length,
    });
  } catch (error) {
    console.error('Admin Registrations Error:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Update Pricing
app.patch('/admin/pricing', adminAuth, async (req, res) => {
  try {
    const { category, eventType, price } = req.body;

    if (!PRICING[category] || !PRICING[category][eventType]) {
      return res.status(400).json({ error: 'Invalid category or event type' });
    }

    PRICING[category][eventType] = price;

    res.json({ success: true, message: 'Pricing updated' });
  } catch (error) {
    console.error('Update Pricing Error:', error);
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// Get Stats
app.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    if (!sheets || !process.env.GOOGLE_SHEET_ID) {
      return res.status(503).json({ error: 'Google Sheets not configured' });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Registrations!A:J',
    });

    const rows = response.data.values || [];
    const data = rows.slice(1);

    const totalRegistrations = data.length;
    const totalRevenue = data.reduce((sum, row) => sum + (parseFloat(row[7]) || 0), 0);

    const categoryStats = {};
    data.forEach(row => {
      const events = (row[5] || '').split(', ') || [];
      events.forEach(event => {
        const parts = event.split('_');
        const catId = parts.slice(0, -1).join('_');
        categoryStats[catId] = (categoryStats[catId] || 0) + 1;
      });
    });

    res.json({
      totalRegistrations,
      totalRevenue,
      categoryStats,
    });
  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API: http://localhost:${PORT}/api`);
  console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('Services Status:');
  console.log(`  Razorpay: ${razorpay ? '✅ Configured' : '⚠️  Demo mode'}`);
  console.log(`  Google Sheets: ${sheets ? '✅ Configured' : '⚠️  Demo mode'}`);
});
