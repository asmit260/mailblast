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

// --- In-memory job state ---
let activeJob = null; // { running, paused, stopped, clients: Set<res> }

// --- SSE helper ---
function sendSSE(clients, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch (_) {}
  }
}

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
// Starts the bulk send job. Accepts multipart/form-data.
// Body fields (JSON stringified in 'config' field):
//   { smtp, recipients, fromName, fromEmail, replyTo, subject,
//     bodyText, bodyHtml, mode, batchSize, batchDelay }
// File fields: attachments[]
// ============================================================
app.post('/api/send', upload.array('attachments', 10), async (req, res) => {
  if (activeJob && activeJob.running) {
    return res.status(409).json({ ok: false, error: 'A send job is already running.' });
  }

  let config;
  try {
    config = JSON.parse(req.body.config);
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Invalid config JSON.' });
  }

  const {
    smtp, recipients, fromName, fromEmail, replyTo,
    subject, bodyText, bodyHtml, mode,
    batchSize = 10, batchDelay = 1000
  } = config;

  if (!smtp || !recipients || !recipients.length || !subject) {
    return res.status(400).json({ ok: false, error: 'Missing required fields.' });
  }

  // Build attachment list from uploaded files
  const attachments = (req.files || []).map(f => ({
    filename: f.originalname,
    content: f.buffer,
    contentType: f.mimetype,
  }));

  // Acknowledge immediately — progress comes via SSE
  const jobId = Date.now().toString();
  activeJob = { running: true, paused: false, stopped: false, clients: new Set() };
  res.json({ ok: true, jobId });

  // Run the send job asynchronously
  runSendJob({ smtp, recipients, fromName, fromEmail, replyTo, subject, bodyText, bodyHtml, mode, attachments, batchSize, batchDelay });
});

async function runSendJob({ smtp, recipients, fromName, fromEmail, replyTo, subject, bodyText, bodyHtml, mode, attachments, batchSize, batchDelay }) {
  const job = activeJob;
  const clients = job.clients;
  const total = recipients.length;

  // Wait for frontend SSE to connect before starting
  await sleep(1000);

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: parseInt(smtp.port, 10),
      secure: smtp.secure === true || smtp.secure === 'true',
      auth: { user: smtp.user, pass: smtp.pass },
      pool: true,
      maxConnections: 5, // Enable fast parallel connections
    });
  } catch (err) {
    sendSSE(clients, 'error', { message: 'Failed to create SMTP transporter: ' + err.message });
    job.running = false;
    return;
  }

  sendSSE(clients, 'start', { total });

  let sentCount = 0;
  let failedCount = 0;

  // Split recipients into batches for concurrent execution
  const recipientBatches = [];
  for (let i = 0; i < recipients.length; i += batchSize) {
    recipientBatches.push(recipients.slice(i, i + batchSize));
  }

  let globalIndex = 0;

  for (let b = 0; b < recipientBatches.length; b++) {
    // Check stop flag
    if (job.stopped) {
      sendSSE(clients, 'stopped', { index: globalIndex, sent: sentCount, failed: failedCount });
      break;
    }

    // Handle pause — wait until unpaused or stopped
    while (job.paused && !job.stopped) {
      await sleep(300);
    }
    if (job.stopped) {
      sendSSE(clients, 'stopped', { index: globalIndex, sent: sentCount, failed: failedCount });
      break;
    }

    const currentBatch = recipientBatches[b];
    const promises = currentBatch.map(async (recipient, localIndex) => {
      const i = globalIndex + localIndex;
      const email = typeof recipient === 'string' ? recipient : recipient.email;

      // Personalize subject and body
      const personalizedSubject = personalize(subject, recipient);
      const personalizedText = bodyText ? personalize(bodyText, recipient) : undefined;
      const personalizedHtml = bodyHtml ? personalize(bodyHtml, recipient) : undefined;

      // Construct professional spam-prevention headers
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
          'X-Report-Abuse': 'mailto:abuse@' + smtp.host,
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
        const duration = Date.now() - start;
        sentCount++;
        sendSSE(clients, 'progress', {
          index: i, total, email, status: 'sent', duration,
          sent: sentCount, failed: failedCount,
        });
      } catch (err) {
        const duration = Date.now() - start;
        failedCount++;
        sendSSE(clients, 'progress', {
          index: i, total, email, status: 'failed', duration,
          error: err.message, sent: sentCount, failed: failedCount,
        });
      }
    });

    // Wait for the entire batch to resolve concurrently
    await Promise.all(promises);

    globalIndex += currentBatch.length;

    // Sleep for the batch delay between batches
    if (b < recipientBatches.length - 1 && !job.stopped) {
      await sleep(batchDelay);
    }
  }

  sendSSE(clients, 'done', { sent: sentCount, failed: failedCount, total });
  job.running = false;
  transporter.close();

  // Clean up clients after short delay
  setTimeout(() => {
    for (const client of clients) {
      try { client.end(); } catch (_) {}
    }
    clients.clear();
  }, 2000);
}

// ============================================================
// GET /api/progress
// SSE stream — client connects and receives real-time events
// ============================================================
app.get('/api/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial heartbeat
  res.write(': connected\n\n');

  if (activeJob) {
    activeJob.clients.add(res);
  }

  // Heartbeat every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    if (activeJob) activeJob.clients.delete(res);
  });
});

// ============================================================
// POST /api/stop
// Halts the active job (or pauses/resumes)
// ============================================================
app.post('/api/stop', (req, res) => {
  const { action } = req.body; // 'stop' | 'pause' | 'resume'

  if (!activeJob) {
    return res.status(404).json({ ok: false, error: 'No active job.' });
  }

  if (action === 'stop') {
    activeJob.stopped = true;
    activeJob.paused = false;
    res.json({ ok: true, action: 'stopped' });
  } else if (action === 'pause') {
    activeJob.paused = true;
    res.json({ ok: true, action: 'paused' });
  } else if (action === 'resume') {
    activeJob.paused = false;
    res.json({ ok: true, action: 'resumed' });
  } else {
    res.status(400).json({ ok: false, error: 'Unknown action. Use stop | pause | resume' });
  }
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
