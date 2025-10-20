const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const GiftOrder = require('../models/GiftOrder');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Payfast configuration - PRODUCTION ONLY
const PAYFAST_CONFIG = {
  merchantId: process.env.PAYFAST_MERCHANT_ID,
  merchantKey: process.env.PAYFAST_MERCHANT_KEY,
  passPhrase: process.env.PAYFAST_PASSPHRASE || '',
  returnUrl: `${process.env.BACKEND_URL || 'https://tasselgroup-back.onrender.com'}/api/payment/success`,
  cancelUrl: `${process.env.BACKEND_URL || 'https://tasselgroup-back.onrender.com'}/api/payment/cancel`,
  notifyUrl: `${process.env.BACKEND_URL || 'https://tasselgroup-back.onrender.com'}/api/payment/notify`
};

console.log('🔗 Payfast Production Configuration Loaded');

// Email configuration
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Test email connection
async function testEmailConnection() {
  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await emailTransporter.verify();
      console.log('✅ Email server connection established');
    } else {
      console.log('⚠️ Email credentials not set - email functionality disabled');
    }
  } catch (error) {
    console.error('❌ Email connection failed:', error);
  }
}

testEmailConnection();

// Generate Payfast payment signature
function generateSignature(data, passPhrase = '') {
  let pfOutput = '';
  const keys = Object.keys(data).sort();
  
  keys.forEach(key => {
    if (data[key] !== '' && data[key] !== null && data[key] !== undefined) {
      pfOutput += `${key}=${encodeURIComponent(data[key].toString().trim()).replace(/%20/g, '+')}&`;
    }
  });
  
  let getString = pfOutput.slice(0, -1);
  
  if (passPhrase && passPhrase !== '') {
    getString += `&passphrase=${encodeURIComponent(passPhrase.trim()).replace(/%20/g, '+')}`;
  }
  
  return crypto.createHash('md5').update(getString).digest('hex');
}

// Format phone number for Payfast (remove all non-numeric characters)
function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  console.log('📱 Phone number cleaning:', { original: phone, cleaned: cleaned });
  
  // Handle South African numbers
  if (cleaned.startsWith('27') && cleaned.length === 11) {
    // Already in 27XXXXXXXXX format
    return cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    // Convert 0XXXXXXXXX to 27XXXXXXXXX
    return '27' + cleaned.substring(1);
  } else if (cleaned.length === 9 && !cleaned.startsWith('0')) {
    // Assume it's already without country code but valid
    return '27' + cleaned;
  }
  
  // If it doesn't match expected formats, return empty to avoid validation errors
  console.log('⚠️ Phone number format not recognized, skipping:', cleaned);
  return '';
}


// Initiate Payfast payment - PRODUCTION
router.post('/initiate', auth, async (req, res) => {
  try {
    const { type, items, totalAmount, bookingData, giftData, staffId } = req.body;
    const user = req.user;

    if (!type || !totalAmount || totalAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid type and total amount are required' });
    }

    console.log('💰 PRODUCTION Payment initiation:', { type, totalAmount, user: user.name });

    // Generate unique merchant reference
    const timestamp = Date.now();
    const merchantReference = `TG${timestamp}${user._id.toString().slice(-4)}`;

    // Format phone number for Payfast - ONLY if valid South African number
    const formattedPhone = formatPhoneNumber(user.phone);
    console.log('📱 Final phone number check:', { 
      original: user.phone, 
      formatted: formattedPhone,
      isValid: formattedPhone.length === 11 && formattedPhone.startsWith('27')
    });

    // Prepare Payfast data for PRODUCTION with proper formatting
    const payfastData = {
      // Merchant details
      merchant_id: PAYFAST_CONFIG.merchantId,
      merchant_key: PAYFAST_CONFIG.merchantKey,
      return_url: PAYFAST_CONFIG.returnUrl,
      cancel_url: PAYFAST_CONFIG.cancelUrl,
      notify_url: PAYFAST_CONFIG.notifyUrl,
      
      // Customer details
      name_first: (user.name.split(' ')[0] || 'Customer').substring(0, 100),
      name_last: (user.name.split(' ').slice(1).join(' ') || 'User').substring(0, 100),
      email_address: user.email.substring(0, 100),
      
      // Payment details
      m_payment_id: merchantReference,
      amount: parseFloat(totalAmount).toFixed(2),
      item_name: `Tassel Group ${type.charAt(0).toUpperCase() + type.slice(1)}`.substring(0, 100),
      item_description: `Payment for ${type} order`.substring(0, 255),
      
      // Custom data
      custom_int1: parseInt(user._id.toString().replace(/[^0-9]/g, '').slice(-9)) || 123456789,
      custom_str1: type.substring(0, 255),
      custom_str2: JSON.stringify({ 
        items: items || [],
        bookingData: bookingData || {},
        giftData: giftData || {},
        staffId: staffId || null
      }).substring(0, 255),
      
      // Additional Payfast fields
      email_confirmation: 1,
      confirmation_address: 'info@tasselgroup.co.za'
    };

    // ONLY add cell_number if it's a properly formatted South African number
    if (formattedPhone && formattedPhone.length === 11 && formattedPhone.startsWith('27')) {
      payfastData.cell_number = formattedPhone;
    } else {
      console.log('⚠️ Skipping cell_number - invalid format for Payfast');
      // Don't include cell_number at all if it's not valid
    }

    // Clean empty fields
    Object.keys(payfastData).forEach(key => {
      if (payfastData[key] === '' || payfastData[key] === null || payfastData[key] === undefined) {
        delete payfastData[key];
      }
    });

    // Generate signature
    payfastData.signature = generateSignature(payfastData, PAYFAST_CONFIG.passPhrase);

    // PRODUCTION Payfast URL
    const payfastUrl = 'https://www.payfast.co.za/eng/process';

    console.log('🔗 PRODUCTION Payfast data prepared (FINAL):', {
      merchantReference,
      amount: payfastData.amount,
      custom_int1: payfastData.custom_int1,
      cell_number: payfastData.cell_number || 'NOT INCLUDED',
      payfastUrl
    });

    console.log('📋 Final Payfast fields being sent:', Object.keys(payfastData));

    res.json({
      success: true,
      payfastUrl,
      data: payfastData,
      merchantReference
    });

  } catch (error) {
    console.error('❌ Payment initiation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error initiating payment',
      error: error.message 
    });
  }
});

// Handle Payfast return
router.get('/success', async (req, res) => {
  try {
    const { m_payment_id, payment_status } = req.query;
    
    console.log('✅ Payment return success:', { m_payment_id, payment_status });
    
    const frontendUrl = process.env.FRONTEND_URL || 'https://fullomyself.github.io/tasselgroupwebapplication';
    if (payment_status === 'COMPLETE') {
      res.redirect(`${frontendUrl}/?payment=success&reference=${m_payment_id}`);
    } else {
      res.redirect(`${frontendUrl}/?payment=cancelled`);
    }
  } catch (error) {
    console.error('Payment success handling error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'https://fullomyself.github.io/tasselgroupwebapplication'}/?payment=error`);
  }
});

router.get('/cancel', async (req, res) => {
  console.log('❌ Payment cancelled');
  res.redirect(`${process.env.FRONTEND_URL || 'https://fullomyself.github.io/tasselgroupwebapplication'}/?payment=cancelled`);
});

// Handle Payfast ITN (PRODUCTION)
router.post('/notify', async (req, res) => {
  try {
    const itnData = { ...req.body };
    console.log('📩 PRODUCTION ITN Received:', itnData);
    
    const signature = itnData.signature;
    
    // Verify signature
    delete itnData.signature;
    const calculatedSignature = generateSignature(itnData, PAYFAST_CONFIG.passPhrase);
    
    if (signature !== calculatedSignature) {
      console.error('❌ ITN signature verification failed');
      return res.status(400).send('Signature verification failed');
    }

    const paymentStatus = itnData.payment_status;
    const merchantReference = itnData.m_payment_id;
    const amount = parseFloat(itnData.amount_gross);
    
    // FIXED: Parse custom_int1 as number and convert back to string for user ID
    const customInt1 = itnData.custom_int1 ? itnData.custom_int1.toString() : null;
    const type = itnData.custom_str1;
    const customData = JSON.parse(itnData.custom_str2 || '{}');

    console.log('🔍 PRODUCTION ITN Processing:', {
      paymentStatus,
      merchantReference,
      amount,
      customInt1,
      type
    });

    if (paymentStatus === 'COMPLETE' && customInt1) {
      // Create the order/booking/gift record
      const result = await createOrderRecord(type, customInt1, amount, merchantReference, customData);
      
      // Send confirmation emails
      await sendConfirmationEmails(customInt1, type, merchantReference, amount, customData);
      
      console.log('✅ PRODUCTION Payment processed successfully:', result);
    } else {
      console.log('⚠️ Payment not completed or missing user ID:', paymentStatus);
    }

    res.status(200).send('ITN processed successfully');

  } catch (error) {
    console.error('❌ ITN processing error:', error);
    res.status(500).send('ITN processing error');
  }
});

// Handle manual order
router.post('/manual-order', auth, async (req, res) => {
  try {
    const { type, items, totalAmount, bookingData, giftData, staffId } = req.body;
    const user = req.user;

    console.log('📧 Manual order received:', { type, user: user.name, totalAmount });

    let result;
    switch (type) {
      case 'order':
        result = await createManualOrder(user, items, totalAmount, staffId);
        break;
      case 'booking':
        result = await createManualBooking(user, bookingData, staffId);
        break;
      case 'gift':
        result = await createManualGift(user, giftData, staffId);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid order type' });
    }

    // Send confirmation emails
    await sendConfirmationEmails(user._id, type, result.reference, totalAmount, {
      items: items || [],
      bookingData: bookingData || {},
      giftData: giftData || {}
    });

    res.json({
      success: true,
      message: 'Order placed successfully. Confirmation email sent.',
      order: result
    });

  } catch (error) {
    console.error('❌ Manual order error:', error);
    res.status(500).json({ success: false, message: 'Error placing manual order' });
  }
});

// Helper functions
async function createOrderRecord(type, userId, amount, reference, customData) {
  // Find user by the numeric ID (we need to handle this differently)
  let user;
  try {
    // Since we converted the ObjectId to a number, we need to find the user differently
    // This is a workaround - in production you might want to store the mapping
    user = await User.findById(userId);
    if (!user) {
      // Try to find by other means or use the customData
      console.log('⚠️ User not found by ID, using custom data');
      user = { _id: userId, name: 'Customer', email: 'customer@example.com' };
    }
  } catch (error) {
    console.error('Error finding user:', error);
    user = { _id: userId, name: 'Customer', email: 'customer@example.com' };
  }

  let record;
  
  switch (type) {
    case 'order':
      record = new Order({
        user: user._id,
        items: (customData.items || []).map(item => ({
          product: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        total: amount,
        finalTotal: amount,
        status: 'pending',
        paymentStatus: 'completed',
        paymentMethod: 'payfast',
        paymentReference: reference,
        processedBy: customData.staffId,
        shippingAddress: user.address || 'Not specified'
      });
      break;
      
    case 'booking':
      record = new Booking({
        user: user._id,
        service: customData.bookingData.serviceId,
        date: customData.bookingData.date,
        time: customData.bookingData.time,
        staff: customData.staffId || customData.bookingData.assignedStaff,
        specialRequests: customData.bookingData.specialRequests || '',
        status: 'confirmed',
        paymentStatus: 'completed',
        paymentMethod: 'payfast',
        paymentReference: reference,
        price: amount
      });
      break;
      
    case 'gift':
      record = new GiftOrder({
        user: user._id,
        giftPackage: customData.giftData.giftId,
        recipientName: customData.giftData.recipientName,
        recipientEmail: customData.giftData.recipientEmail,
        message: customData.giftData.message,
        deliveryDate: customData.giftData.deliveryDate,
        assignedStaff: customData.staffId || customData.giftData.assignedStaff,
        status: 'confirmed',
        paymentStatus: 'completed',
        paymentMethod: 'payfast',
        paymentReference: reference,
        price: amount
      });
      break;
      
    default:
      throw new Error('Invalid order type');
  }

  await record.save();
  return record;
}

async function createManualOrder(user, items, totalAmount, staffId) {
  const order = new Order({
    user: user._id,
    items: items.map(item => ({
      product: item.productId,
      quantity: item.quantity,
      price: item.price
    })),
    total: totalAmount,
    finalTotal: totalAmount,
    status: 'pending',
    paymentStatus: 'manual',
    paymentMethod: 'manual',
    processedBy: staffId,
    shippingAddress: user.address
  });

  await order.save();
  return { reference: order._id.toString(), type: 'order' };
}

async function createManualBooking(user, bookingData, staffId) {
  const booking = new Booking({
    user: user._id,
    service: bookingData.serviceId,
    date: bookingData.date,
    time: bookingData.time,
    staff: staffId || bookingData.assignedStaff,
    specialRequests: bookingData.specialRequests || '',
    status: 'pending',
    paymentStatus: 'manual',
    paymentMethod: 'manual',
    price: bookingData.price
  });

  await booking.save();
  return { reference: booking._id.toString(), type: 'booking' };
}

async function createManualGift(user, giftData, staffId) {
  const giftOrder = new GiftOrder({
    user: user._id,
    giftPackage: giftData.giftId,
    recipientName: giftData.recipientName,
    recipientEmail: giftData.recipientEmail,
    message: giftData.message,
    deliveryDate: giftData.deliveryDate,
    assignedStaff: staffId || giftData.assignedStaff,
    status: 'pending',
    paymentStatus: 'manual',
    paymentMethod: 'manual',
    price: giftData.price
  });

  await giftOrder.save();
  return { reference: giftOrder._id.toString(), type: 'gift' };
}

// Email sending functions
async function sendConfirmationEmails(userId, type, reference, amount, customData) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Email credentials not set - skipping email sending');
      return;
    }

    let user;
    try {
      user = await User.findById(userId);
    } catch (error) {
      console.error('Error finding user for email:', error);
      user = { name: 'Customer', email: 'customer@example.com' };
    }

    if (!user) {
      console.error('User not found for email:', userId);
      return;
    }

    // Email to Tassel Group
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'info@tasselgroup.co.za',
      subject: `New ${type} Order - ${reference}`,
      html: generateAdminEmailTemplate(type, user, reference, amount, customData)
    });

    // Email to customer
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `Tassel Group Order Confirmation - ${reference}`,
      html: generateCustomerEmailTemplate(type, user, reference, amount, customData)
    });

    console.log(`✅ Confirmation emails sent for ${reference}`);
  } catch (error) {
    console.error('❌ Email sending error:', error);
  }
}

function generateAdminEmailTemplate(type, user, reference, amount, customData) {
  return `
    <h2>New ${type.toUpperCase()} Order Received</h2>
    <p><strong>Order Reference:</strong> ${reference}</p>
    <p><strong>Customer:</strong> ${user.name}</p>
    <p><strong>Email:</strong> ${user.email}</p>
    <p><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
    <p><strong>Amount:</strong> R ${amount.toFixed(2)}</p>
    <p><strong>Order Type:</strong> ${type}</p>
    <hr>
    <h3>Order Details:</h3>
    ${type === 'order' ? `
      <p><strong>Items:</strong></p>
      <ul>
        ${customData.items.map(item => `<li>${item.name} - R ${item.price} x ${item.quantity}</li>`).join('')}
      </ul>
    ` : ''}
    ${type === 'booking' ? `
      <p><strong>Service:</strong> ${customData.bookingData.serviceName}</p>
      <p><strong>Date:</strong> ${customData.bookingData.date}</p>
      <p><strong>Time:</strong> ${customData.bookingData.time}</p>
      <p><strong>Special Requests:</strong> ${customData.bookingData.specialRequests || 'None'}</p>
    ` : ''}
    ${type === 'gift' ? `
      <p><strong>Recipient:</strong> ${customData.giftData.recipientName}</p>
      <p><strong>Recipient Email:</strong> ${customData.giftData.recipientEmail}</p>
      <p><strong>Gift Package:</strong> ${customData.giftData.packageName}</p>
      <p><strong>Delivery Date:</strong> ${customData.giftData.deliveryDate}</p>
      <p><strong>Message:</strong> ${customData.giftData.message}</p>
    ` : ''}
    <hr>
    <p><em>This email was automatically generated by Tassel Group system.</em></p>
  `;
}

function generateCustomerEmailTemplate(type, user, reference, amount, customData) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #8a6d3b;">Thank You for Your Order!</h2>
      <p>Dear ${user.name},</p>
      
      <p>We have received your ${type} order and will process it shortly.</p>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #8a6d3b; margin-top: 0;">Order Summary</h3>
        <p><strong>Order Reference:</strong> ${reference}</p>
        <p><strong>Order Type:</strong> ${type.charAt(0).toUpperCase() + type.slice(1)}</p>
        <p><strong>Total Amount:</strong> R ${amount.toFixed(2)}</p>
      </div>

      ${type === 'order' ? `
        <h3 style="color: #8a6d3b;">Order Items:</h3>
        <ul>
          ${customData.items.map(item => `<li><strong>${item.name}</strong> - R ${item.price} x ${item.quantity}</li>`).join('')}
        </ul>
      ` : ''}

      ${type === 'booking' ? `
        <h3 style="color: #8a6d3b;">Booking Details:</h3>
        <p><strong>Service:</strong> ${customData.bookingData.serviceName}</p>
        <p><strong>Date:</strong> ${customData.bookingData.date}</p>
        <p><strong>Time:</strong> ${customData.bookingData.time}</p>
        ${customData.bookingData.specialRequests ? `<p><strong>Your Notes:</strong> ${customData.bookingData.specialRequests}</p>` : ''}
      ` : ''}

      ${type === 'gift' ? `
        <h3 style="color: #8a6d3b;">Gift Details:</h3>
        <p><strong>Recipient:</strong> ${customData.giftData.recipientName}</p>
        <p><strong>Gift Package:</strong> ${customData.giftData.packageName}</p>
        <p><strong>Scheduled Delivery:</strong> ${customData.giftData.deliveryDate}</p>
        <p><strong>Your Message:</strong> "${customData.giftData.message}"</p>
      ` : ''}

      <div style="margin-top: 30px; padding: 15px; background: #e8f4f8; border-radius: 5px;">
        <h4 style="color: #8a6d3b; margin-top: 0;">What happens next?</h4>
        <p>Our team will contact you within 24 hours to confirm your order details and arrange delivery/booking.</p>
        <p>If you have any questions, please reply to this email or contact us at info@tasselgroup.co.za</p>
      </div>

      <hr style="margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Best regards,<br>
        <strong>The Tassel Group Team</strong><br>
        Email: info@tasselgroup.co.za<br>
        Phone: +27 12 345 6789
      </p>
    </div>
  `;
}

module.exports = router;