/**
 * smtp.js — SMTP configuration panel
 */
import { toast } from './toast.js';

const PRESETS = {
  gmail:   { host: 'smtp.gmail.com',       port: 587,  secure: false },
  outlook: { host: 'smtp.office365.com',   port: 587,  secure: false },
  yahoo:   { host: 'smtp.mail.yahoo.com',  port: 465,  secure: true  },
  custom:  { host: '',                     port: 587,  secure: false },
};

export function initSmtp(state) {
  const hostEl   = document.getElementById('smtp-host');
  const portEl   = document.getElementById('smtp-port');
  const secureEl = document.getElementById('smtp-secure');
  const userEl   = document.getElementById('smtp-user');
  const passEl   = document.getElementById('smtp-pass');
  const testBtn  = document.getElementById('btn-test-smtp');

  const saved = JSON.parse(localStorage.getItem('bm-smtp') || '{}');
  if (saved.host) {
    hostEl.value = saved.host;
    portEl.value = saved.port || 587;
    secureEl.checked = saved.secure || false;
    userEl.value = saved.user || '';
    passEl.value = saved.pass || '';
    Object.assign(state.smtp, saved);
    updateToggleThumb();
  } else {
    applyPreset('gmail');
  }

  document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn[data-preset]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyPreset(btn.dataset.preset);
    });
  });

  [hostEl, portEl, userEl, passEl].forEach(el => el.addEventListener('input', syncState));
  secureEl.addEventListener('change', () => { syncState(); updateToggleThumb(); });

  testBtn.addEventListener('click', testConnection);

  function applyPreset(name) {
    const p = PRESETS[name] || PRESETS.custom;
    hostEl.value = p.host;
    portEl.value = p.port;
    secureEl.checked = p.secure;
    updateToggleThumb();
    syncState();
  }

  function syncState() {
    state.smtp = {
      host: hostEl.value.trim(),
      port: parseInt(portEl.value, 10) || 587,
      secure: secureEl.checked,
      user: userEl.value.trim(),
      pass: passEl.value,
    };
    localStorage.setItem('bm-smtp', JSON.stringify(state.smtp));
  }

  function updateToggleThumb() {
    // Removed text insertion per user request
  }

  async function testConnection() {
    if (!state.smtp.host || !state.smtp.user || !state.smtp.pass) {
      toast('ERR: INCOMPLETE SMTP DATA', 'error');
      return;
    }
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    
    appendLog('> Initiating connection...', 'text-success');

    try {
      const res = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.smtp),
      });
      const data = await res.json();
      
      setTimeout(() => appendLog('> Authenticating user...', 'text-success'), 300);


      setTimeout(() => {
        if (data.ok) {
          appendLog('> STATUS: CONNECTED ✓', 'text-success');
          
          const dot = document.getElementById('nav-smtp-dot');
          if (dot) dot.className = 'smtp-dot connected';
          
          const label = document.getElementById('nav-smtp-label');
          if (label) label.textContent = 'SMTP Online';
          
          const badge = document.getElementById('smtp-status-badge');
          if (badge) {
              badge.textContent = 'Connected';
              badge.className = 'status-badge connected';
          }
          const provider = document.getElementById('smtp-provider-val');
          if (provider) provider.textContent = state.smtp.host;
          
          const enc = document.getElementById('smtp-enc-val');
          if (enc) enc.textContent = state.smtp.secure ? 'TLS/SSL' : 'STARTTLS';
          
          const verified = document.getElementById('smtp-verified-val');
          if (verified) verified.textContent = new Date().toLocaleTimeString();

          state.smtpOk = true;
        } else {
          appendLog('> ERR: ' + data.error, 'text-danger');
          
          const dot = document.getElementById('nav-smtp-dot');
          if (dot) dot.className = 'smtp-dot error';
          
          const label = document.getElementById('nav-smtp-label');
          if (label) label.textContent = 'SMTP Error';
          
          const badge = document.getElementById('smtp-status-badge');
          if (badge) {
              badge.textContent = 'Error';
              badge.className = 'status-badge error';
          }

          state.smtpOk = false;
        }
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
      }, 800);
      
    } catch (err) {
      appendLog('> ERR: SERVER UNREACHABLE', 'text-danger');
      
      const dot = document.getElementById('nav-smtp-dot');
      if (dot) dot.className = 'smtp-dot error';
      
      const label = document.getElementById('nav-smtp-label');
      if (label) label.textContent = 'SMTP Error';
      
      const badge = document.getElementById('smtp-status-badge');
      if (badge) {
          badge.textContent = 'Error';
          badge.className = 'status-badge error';
      }

      state.smtpOk = false;
      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';
    }
  }

  function appendLog(msg, colorClass) {
    const logDiv = document.getElementById('smtp-terminal-log');
    const cursor = logDiv.querySelector('.blinking-cursor');
    const line = document.createElement('div');
    line.className = `log-line ${colorClass}`;
    line.textContent = msg;
    logDiv.insertBefore(line, cursor);
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}
