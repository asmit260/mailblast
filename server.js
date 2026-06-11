/**
 * BulkMailer — server.js
 * Express + Nodemailer backend. No database. One command to run.
 * Usage: node server.js
 */

const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
// Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for simplicity, but recommended to enable and configure in production
}));
app.use(cors());
app.use(compression()); // Gzip compression for fast UI loading
app.use(express.json({ limit: '50mb' }));
// Cache static assets for 1 day to ensure blazingly fast reloads
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

// --- Rate Limiting ---
// Basic rate limiting to prevent brute-force or basic DDoS on API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { ok: false, error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// Apply rate limiting to all /api routes
app.use('/api', apiLimiter);

// Multer: store attachments in memory (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 25 * 1024 * 1024, // 25MB per file
    files: 10 // Max 10 attachments to prevent memory exhaustion
  }
});

// --- Serverless-compatible Batch Sending ---
// No in-memory state or SSE, frontend manages the loop

// ============================================================
// POST /api/test-smtp
// Validates SMTP credentials by sending a test email to self
// ============================================================
app.post('/api/test-smtp', async (req, res) => {
  const { host, port, secure, user, pass } = req.body;

  if (!host || !port || !user || !pass) {
    return res.status(400).json({ ok: false, error: 'Missing required SMTP fields.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: secure === true || secure === 'true',
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
    });

    await transporter.verify();

    // Send test email to self
    await transporter.sendMail({
      from: `"BulkMailer Test" <${user}>`,
      to: user,
      subject: 'BulkMailer — SMTP Connection Verified ✓',
      text: 'Your SMTP connection is working correctly. You\'re ready to send bulk emails.',
    });

    res.json({ ok: true, message: `Test email sent to ${user}` });
  } catch (err) {
    // Return 200 so the frontend can display the error gracefully in a toast
    // instead of the browser throwing a red 400 Bad Request in the console.
    res.json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/send
// Processes a single batch of emails. Designed for Serverless.
// Accepts multipart/form-data.
// Body fields (JSON stringified in 'config' field):
//   { smtp, recipients, fromName, fromEmail, replyTo, subject, bodyText, bodyHtml, mode }
// File fields: attachments[]
// ============================================================
app.post('/api/send', upload.array('attachments', 10), async (req, res) => {
  let config;
  try {
    config = JSON.parse(req.body.config);
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Invalid config JSON.' });
  }

  const { smtp, recipients, fromName, fromEmail, replyTo, subject, bodyText, bodyHtml, mode } = config;

  if (!smtp || !recipients || !recipients.length || !subject) {
    return res.status(400).json({ ok: false, error: 'Missing required fields.' });
  }

  const attachments = (req.files || []).map(f => ({
    filename: f.originalname,
    content: f.buffer,
    contentType: f.mimetype,
  }));

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: parseInt(smtp.port, 10),
      secure: smtp.secure === true || smtp.secure === 'true',
      auth: { user: smtp.user, pass: smtp.pass },
      pool: false, // create single-use connections for serverless
      connectionTimeout: 10000,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'SMTP config error: ' + err.message });
  }

  const results = [];
  let sentCount = 0;
  let failedCount = 0;

  const promises = recipients.map(async (recipient) => {
    const email = typeof recipient === 'string' ? recipient : recipient.email;

    const personalizedSubject = personalize(subject, recipient);
    const personalizedText = bodyText ? personalize(bodyText, recipient) : undefined;
    const personalizedHtml = bodyHtml ? personalize(bodyHtml, recipient) : undefined;

    const mailOptions = {
      from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
      to: email,
      replyTo: replyTo || undefined,
      subject: personalizedSubject,
      attachments,
      headers: {
        'List-Unsubscribe': `<mailto:unsubscribe@${smtp.host}>`,
        'Precedence': 'bulk',
        'X-Mailer': 'MailBlast Platform',
        'X-Auto-Response-Suppress': 'OOF, AutoReply'
      }
    };

    if (mode === 'html' || mode === 'rich') {
      mailOptions.html = personalizedHtml || personalizedText;
      mailOptions.text = personalizedText ? stripHtml(personalizedText) : htmlToText(personalizedHtml || '');
    } else {
      mailOptions.text = personalizedText;
    }

    const start = Date.now();
    try {
      await transporter.sendMail(mailOptions);
      sentCount++;
      results.push({ email, status: 'sent', duration: Date.now() - start });
    } catch (err) {
      failedCount++;
      results.push({ email, status: 'failed', duration: Date.now() - start, error: err.message });
    }
  });

  await Promise.all(promises);
  transporter.close();

  res.json({ ok: true, sent: sentCount, failed: failedCount, results });
});

// ============================================================
// Helpers
// ============================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function personalize(template, recipient) {
  if (!template || typeof recipient === 'string') return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return recipient[key] !== undefined ? recipient[key] : `{{${key}}}`;
  });
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<style([\s\S]*?)<\/style>/gi, '')
    .replace(/<script([\s\S]*?)<\/script>/gi, '')
    .replace(/<\/div>/ig, '\n')
    .replace(/<\/li>/ig, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

// ============================================================
// Start
// ============================================================
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n  ■ BULKMAILER running at http://localhost:${PORT}\n`);
  });
}
module.exports = app;
