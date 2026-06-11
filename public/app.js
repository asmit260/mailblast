/**
 * BulkMailer — app.js
 * Main entry point. Imports and wires all modules.
 */

import { initSmtp } from './modules/smtp.js';
import { initRecipients } from './modules/recipients.js';
import { initComposer } from './modules/composer.js';
import { initSend } from './modules/send.js';
import { initTheme } from './modules/theme.js';
import { initKeyboard } from './modules/keyboard.js';
import { initWizard } from './modules/wizard.js';
import { toast } from './modules/toast.js';
import { appConfig } from './config.js';

// Global shared state
export const state = {
  smtp: { host: '', port: 587, secure: false, user: '', pass: '' },
  smtpOk: false,
  recipients: [],       // [{email, name, ...cols}]
  attachments: [],      // File objects
  composer: {
    fromName: '', fromEmail: '', replyTo: '',
    subject: '', bodyText: '', bodyHtml: '', mode: 'text'
  },
  job: {
    running: false, paused: false,
    total: 0, sent: 0, failed: 0,
    results: []          // [{email, status, duration, error}]
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSmtp(state);
  initRecipients(state);
  initComposer(state);
  initSend(state);
  initKeyboard(state);
  initWizard(state);
  
  // Wires up global Top-Nav Safety & Guide Dialog Modal
  const helpBtn = document.getElementById('btn-show-help');
  const helpDialog = document.getElementById('help-dialog');
  const closeHelpBtn = document.getElementById('btn-close-help');

  if (helpBtn && helpDialog && closeHelpBtn) {
    helpBtn.addEventListener('click', () => {
      helpDialog.showModal();
    });

    closeHelpBtn.addEventListener('click', () => {
      helpDialog.close();
    });

    // Close on clicking outer backdrop overlay
    helpDialog.addEventListener('click', (e) => {
      if (e.target === helpDialog) {
        helpDialog.close();
      }
    });

    // Handle help pane tab switching inside dialog
    helpDialog.querySelectorAll('.tab-btn[data-help-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        helpDialog.querySelectorAll('.tab-btn[data-help-tab]').forEach(b => b.classList.remove('active'));
        helpDialog.querySelectorAll('.help-pane').forEach(p => p.style.display = 'none');
        btn.classList.add('active');
        document.getElementById(`help-pane-${btn.dataset.helpTab}`).style.display = 'block';
      });
    });
  }

  // Set links from config
  const githubLink = document.getElementById('link-github');
  const gmailLink = document.getElementById('link-gmail');
  const sourceLink = document.getElementById('link-source');
  if (githubLink) githubLink.href = appConfig.githubLink;
  if (gmailLink) gmailLink.href = appConfig.gmailLink;
  if (sourceLink) sourceLink.href = appConfig.sourceCodeLink;

  console.log('■ BulkMailer ready');
});
