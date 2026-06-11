/**
 * wizard.js — Handles step-by-step navigation and validation
 */
import { toast } from './toast.js';

export function initWizard(state) {
  let currentStep = 1;
  const maxSteps = 5;

  const btnNext = document.getElementById('wiz-next');
  const btnBack = document.getElementById('wiz-back');
  const btnSendPrepare = document.getElementById('btn-send-prepare');

  btnNext.addEventListener('click', () => {
    if (validateStep(currentStep, state)) {
      goToStep(currentStep + 1);
    }
  });

  btnBack.addEventListener('click', () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  });

  btnSendPrepare.addEventListener('click', () => {
    if (validateStep(4, state)) {
      goToStep(5);
    }
  });

  window.goToWizardStep = goToStep;

  function goToStep(step) {
    if (step < 1 || step > maxSteps) return;
    
    // Hide all steps
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
    // Show target step
    document.getElementById(`step-${step}`).classList.add('active');

    // Update stepper indicators
    document.querySelectorAll('.workflow-step').forEach(el => {
      const s = parseInt(el.dataset.step, 10);
      el.classList.toggle('active', s === step);
    });

    currentStep = step;

    // Update footer buttons
    btnBack.style.visibility = step === 1 ? 'hidden' : 'visible';
    
    if (step === 4) {
      btnNext.classList.add('hidden');
      btnSendPrepare.classList.remove('hidden');

      // Populate review section
      document.getElementById('rv-subject').textContent = state.composer.subject || '—';
      document.getElementById('rv-preview').textContent = document.getElementById('preview-text').value || '—';
      document.getElementById('rv-from').textContent = state.composer.fromName ? `${state.composer.fromName} <${state.composer.fromEmail}>` : state.composer.fromEmail || '—';
      
      const totalRecipients = state.recipients.length;
      document.getElementById('rv-total').textContent = totalRecipients;
      // In this setup, invalid emails are dropped during load, so all loaded are valid.
      document.getElementById('rv-valid').textContent = totalRecipients;
      document.getElementById('rv-invalid').textContent = '0';
      
      document.getElementById('rv-provider').textContent = state.smtp.host || '—';
      document.getElementById('rv-smtp-status').textContent = state.smtpOk ? 'Verified' : 'Offline';
      document.getElementById('rv-smtp-status').className = state.smtpOk ? 'review-val text-success' : 'review-val text-muted';
      document.getElementById('rv-encryption').textContent = state.smtp.secure ? 'TLS/SSL' : 'STARTTLS';
      
      document.getElementById('rv-attachments').textContent = `${state.attachments.length} files`;
      
      const batchSize = parseInt(document.getElementById('batch-size').value, 10) || 10;
      document.getElementById('rv-batch').textContent = `${batchSize} / batch`;
      
      // Calculate est duration
      const delay = parseInt(document.getElementById('batch-delay').value, 10) || 1000;
      const batches = Math.ceil(totalRecipients / batchSize);
      const estMs = batches * delay;
      document.getElementById('rv-duration').textContent = estMs > 60000 ? `${Math.round(estMs/60000)} min` : `${Math.round(estMs/1000)} sec`;

    } else if (step === 5) {
      btnNext.classList.add('hidden');
      btnSendPrepare.classList.add('hidden');
      btnBack.style.visibility = 'hidden';
      
      // Initialize launch screen stats
      document.getElementById('ls-recipients').textContent = state.recipients.length;
      document.getElementById('ls-attachments').textContent = state.attachments.length;
      
      const batchSize = parseInt(document.getElementById('batch-size').value, 10) || 10;
      const delay = parseInt(document.getElementById('batch-delay').value, 10) || 1000;
      const batches = Math.ceil(state.recipients.length / batchSize);
      const estMs = batches * delay;
      document.getElementById('ls-duration').textContent = estMs > 60000 ? `${Math.round(estMs/60000)} min` : `${Math.round(estMs/1000)} sec`;
      
    } else {
      btnNext.classList.remove('hidden');
      btnSendPrepare.classList.add('hidden');
    }
  }

  function validateStep(step, state) {
    if (step === 1) {
      if (!state.smtpOk) {
        toast('ERR: SMTP CONNECTION REQUIRED', 'error');
        return false;
      }
      return true;
    }
    
    if (step === 2) {
      if (state.recipients.length === 0) {
        toast('ERR: NO RECIPIENT DATA', 'error');
        return false;
      }
      return true;
    }

    if (step === 3) {
      if (!state.composer.subject) {
        toast('ERR: SUBJECT CANNOT BE EMPTY', 'error');
        return false;
      }
      if (!state.composer.bodyText && !state.composer.bodyHtml) {
        toast('ERR: BODY CANNOT BE EMPTY', 'error');
        return false;
      }
      
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (state.composer.fromEmail && !EMAIL_RE.test(state.composer.fromEmail.trim())) {
        toast('ERR: INVALID FROM EMAIL FORMAT', 'error');
        return false;
      }
      if (state.composer.replyTo && !EMAIL_RE.test(state.composer.replyTo.trim())) {
        toast('ERR: INVALID REPLY-TO EMAIL FORMAT', 'error');
        return false;
      }
    }

    return true;
  }
}
