/**
 * mailer.js — Real email sending via nodemailer
 * Install: npm install nodemailer
 *
 * Add to server .env:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=your@gmail.com
 *   SMTP_PASS=your-app-password     ← Gmail: enable 2FA → App Passwords → generate
 *   FROM_EMAIL=noreply@dead-or-alive.io
 *
 * For Gmail specifically, use an App Password (not your real password).
 * Google: Account → Security → 2-Step Verification → App Passwords
 */
const nodemailer = require('nodemailer');
const logger = require('./utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('[mailer] SMTP not configured — emails will only be logged to console');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

/**
 * Send a generic notification email (ban, gift, beta approval, password changed, etc.)
 */
async function sendNotificationEmail(to, title, message) {
  const transport = getTransporter();

  if (!transport) {
    logger.info(`[Notification Email] Would send to ${to}: "${title}" — ${message}`);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="background:#0a0a0a;color:#fff;font-family:monospace;padding:40px;max-width:500px;margin:0 auto;">
      <div style="border:1px solid #1a3a1a;border-radius:8px;padding:32px;background:#0d1a0d;">
        <h1 style="color:#4ade80;font-size:24px;margin:0 0 8px;">DEAD OR ALIVE</h1>
        <p style="color:#6b7280;font-size:12px;margin:0 0 24px;letter-spacing:0.1em;">LOGIC ESCAPE</p>

        <h2 style="color:#fff;font-size:18px;margin:0 0 12px;">${title}</h2>
        <p style="color:#d1d5db;font-size:14px;line-height:1.6;">${message}</p>

        <hr style="border:none;border-top:1px solid #1f2937;margin:24px 0;"/>
        <p style="color:#4b5563;font-size:11px;margin:0;">
          You can manage your notification preferences in your profile settings.<br/>
          Dead or Alive: Logic Escape — do not reply to this email
        </p>
      </div>
    </body>
    </html>
  `;

  await transport.sendMail({
    from: `"Dead or Alive" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to,
    subject: `${title} — Dead or Alive`,
    html,
    text: `${title}\n\n${message}`,
  });

  logger.info(`[mailer] Notification email sent to ${to}: ${title}`);
}

/**
 * Send a payment receipt email with the PDF attached
 */
async function sendReceiptEmail(to, payment, pdfBuffer) {
  const transport = getTransporter();
  const amountRupees = (payment.amount / 100).toFixed(2);

  if (!transport) {
    logger.info(`[Receipt Email] Would send to ${to}: Receipt ${payment.receiptNumber} for Rs.${amountRupees}`);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="background:#0a0a0a;color:#fff;font-family:monospace;padding:40px;max-width:500px;margin:0 auto;">
      <div style="border:1px solid #1a3a1a;border-radius:8px;padding:32px;background:#0d1a0d;">
        <h1 style="color:#4ade80;font-size:24px;margin:0 0 8px;">DEAD OR ALIVE</h1>
        <p style="color:#6b7280;font-size:12px;margin:0 0 24px;letter-spacing:0.1em;">LOGIC ESCAPE</p>

        <h2 style="color:#fff;font-size:18px;margin:0 0 12px;">Payment Confirmed 🎉</h2>
        <p style="color:#d1d5db;font-size:14px;line-height:1.6;">
          Thanks for subscribing! Your <strong style="color:#4ade80;">${payment.plan.toUpperCase()}</strong>
          subscription is now active.
        </p>

        <div style="background:#111;border:1px solid #166534;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="color:#9ca3af;font-size:11px;margin:0 0 4px;">Amount Paid</p>
          <p style="color:#4ade80;font-size:24px;font-weight:bold;margin:0;">Rs. ${amountRupees}</p>
          <p style="color:#6b7280;font-size:11px;margin:12px 0 0;">Receipt: ${payment.receiptNumber}</p>
        </div>

        <p style="color:#6b7280;font-size:12px;">Your full receipt is attached as a PDF to this email.</p>

        <hr style="border:none;border-top:1px solid #1f2937;margin:24px 0;"/>
        <p style="color:#4b5563;font-size:11px;margin:0;">
          Dead or Alive: Logic Escape — do not reply to this email
        </p>
      </div>
    </body>
    </html>
  `;

  await transport.sendMail({
    from: `"Dead or Alive" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to,
    subject: `Receipt ${payment.receiptNumber} — Dead or Alive ${payment.plan.toUpperCase()}`,
    html,
    text: `Payment confirmed! Rs. ${amountRupees} for ${payment.plan.toUpperCase()}. Receipt: ${payment.receiptNumber}`,
    attachments: [
      {
        filename: `receipt-${payment.receiptNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  logger.info(`[mailer] Receipt email sent to ${to}: ${payment.receiptNumber}`);
}

/**
 * Send OTP email for verification
 */
async function sendEmailOTP(to, otp, purpose = 'email') {
  const transport = getTransporter();

  if (!transport) {
    // Fallback: log to console (development mode)
    logger.info(`[OTP] Would send to ${to}: ${otp} (${purpose}) — configure SMTP to send real emails`);
    return;
  }

  const subjects = {
    email: 'Verify your email — Dead or Alive',
    phone: 'Your verification code — Dead or Alive',
    password_reset: 'Reset your password — Dead or Alive',
    admin: 'Admin verification — Dead or Alive',
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="background:#0a0a0a;color:#fff;font-family:monospace;padding:40px;max-width:500px;margin:0 auto;">
      <div style="border:1px solid #1a3a1a;border-radius:8px;padding:32px;background:#0d1a0d;">
        <h1 style="color:#4ade80;font-size:28px;margin:0 0 8px;">DEAD OR ALIVE</h1>
        <p style="color:#6b7280;font-size:12px;margin:0 0 32px;letter-spacing:0.1em;">LOGIC ESCAPE</p>

        <p style="color:#d1d5db;margin-bottom:8px;">Your verification code:</p>

        <div style="background:#111;border:2px solid #166534;border-radius:8px;padding:24px;text-align:center;margin:16px 0;">
          <span style="color:#4ade80;font-size:36px;font-weight:bold;letter-spacing:0.3em;">${otp}</span>
        </div>

        <p style="color:#6b7280;font-size:12px;margin-top:24px;">
          This code expires in <strong style="color:#9ca3af;">10 minutes</strong>.<br>
          If you didn't request this, ignore this email.
        </p>

        <hr style="border:none;border-top:1px solid #1f2937;margin:24px 0;"/>
        <p style="color:#4b5563;font-size:11px;margin:0;">Dead or Alive: Logic Escape — do not reply to this email</p>
      </div>
    </body>
    </html>
  `;

  await transport.sendMail({
    from: `"Dead or Alive" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to,
    subject: subjects[purpose] || subjects.email,
    html,
    text: `Your verification code: ${otp}\n\nExpires in 10 minutes.`,
  });

  logger.info(`[mailer] OTP sent to ${to} (${purpose})`);
}

/**
 * Send WhatsApp OTP via Twilio
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 */
async function sendWhatsAppOTP(phone, otp) {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    logger.info(`[OTP] WhatsApp to ${phone}: ${otp} — configure Twilio env vars to send real messages`);
    return;
  }
  const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await twilio.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${phone}`,
    body: `Your Dead or Alive verification code: *${otp}*\n\nExpires in 10 minutes. Do not share this code.`,
  });
  logger.info(`[mailer] WhatsApp OTP sent to ${phone}`);
}

/**
 * Send SMS OTP via Twilio
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM
 */
async function sendSMSOTP(phone, otp) {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    logger.info(`[OTP] SMS to ${phone}: ${otp} — configure Twilio env vars to send real messages`);
    return;
  }
  const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await twilio.messages.create({
    from: process.env.TWILIO_SMS_FROM,
    to: phone,
    body: `Dead or Alive: Your code is ${otp}. Expires in 10 minutes.`,
  });
  logger.info(`[mailer] SMS OTP sent to ${phone}`);
}

/**
 * Verify SMTP connection on startup (optional health check)
 */
async function verifyConnection() {
  const transport = getTransporter();
  if (!transport) return false;
  try {
    await transport.verify();
    logger.info('[mailer] SMTP connection verified ✅');
    return true;
  } catch (err) {
    logger.error('[mailer] SMTP connection failed:', err.message);
    return false;
  }
}

module.exports = { sendEmailOTP, sendWhatsAppOTP, sendSMSOTP, verifyConnection, sendNotificationEmail, sendReceiptEmail };
