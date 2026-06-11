/**
 * composer.js — Email composer panel
 * Tab switching, Quill lazy-load, attachments, preview
 */
import { toast } from './toast.js';

export function initComposer(state) {
  document.querySelectorAll('.tab-btn[data-compose-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchComposeTab(btn.dataset.composeTab, state));
  });

  const subjectEl = document.getElementById('subject');
  const counterEl = document.getElementById('subject-counter');
  if (subjectEl && counterEl) {
    subjectEl.addEventListener('input', () => {
      const n = subjectEl.value.length;
      counterEl.textContent = `${n} CHARS`;
      state.composer.subject = subjectEl.value;
    });
  }

  syncInput('from-name',  v => state.composer.fromName  = v);
  syncInput('from-email', v => state.composer.fromEmail = v);
  syncInput('reply-to',   v => state.composer.replyTo   = v);
  syncInput('subject',    v => state.composer.subject   = v);
  syncInput('body-text',  v => state.composer.bodyText  = v);
  syncInput('html-source',v => state.composer.bodyHtml  = v);

  initAttachments(state);
  document.getElementById('btn-preview-email').addEventListener('click', () => sendPreview(state));
  
  // Ensure preview is updated when clicking next to go to Step 4 (Preview)
  document.getElementById('wiz-next').addEventListener('click', () => {
    saveCurrentContent(state);
    renderPreview(state);
  });
}

function syncInput(id, setter) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => setter(el.value));
}

let quillInstance = null;

async function switchComposeTab(tab, state) {
  saveCurrentContent(state);

  document.querySelectorAll('.tab-btn[data-compose-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.composeTab === tab);
  });

  document.getElementById('editor-text').classList.toggle('hidden', tab !== 'text');
  document.getElementById('editor-rich').classList.toggle('hidden', tab !== 'rich');
  document.getElementById('editor-html').classList.toggle('hidden', tab !== 'html');

  state.composer.mode = tab;

  if (tab === 'rich') {
    await loadQuill(state);
    // Push changes back to Quill upon tab focus to fix Desync Bug
    if (quillInstance) {
      if (state.composer.bodyHtml) {
        quillInstance.root.innerHTML = state.composer.bodyHtml;
      } else if (state.composer.bodyText) {
        quillInstance.setText(state.composer.bodyText);
      }
    }
  }
  renderPreview(state);
}

function saveCurrentContent(state) {
  const textEl = document.getElementById('body-text');
  const htmlEl = document.getElementById('html-source');
  if (!document.getElementById('editor-text').classList.contains('hidden')) {
    state.composer.bodyText = textEl.value;
  }
  if (!document.getElementById('editor-html').classList.contains('hidden')) {
    state.composer.bodyHtml = htmlEl.value;
  }
  if (quillInstance && !document.getElementById('editor-rich').classList.contains('hidden')) {
    state.composer.bodyHtml = quillInstance.root.innerHTML;
    state.composer.bodyText = quillInstance.getText();
  }
}

async function loadQuill(state) {
  if (quillInstance) return;

  if (!window.Quill) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/lib/quill.snow.css';
    document.head.appendChild(link);
    await loadScript('/lib/quill.min.js');
  }

  quillInstance = new Quill('#quill-editor', {
    theme: 'snow',
    modules: { toolbar: [
      ['bold','italic','underline','strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link','image'],
      ['clean']
    ]},
    placeholder: '>> Enter payload data...'
  });

  if (state.composer.bodyHtml) {
    quillInstance.root.innerHTML = state.composer.bodyHtml;
  } else if (state.composer.bodyText) {
    quillInstance.setText(state.composer.bodyText);
  }

  quillInstance.on('text-change', () => {
    state.composer.bodyHtml = quillInstance.root.innerHTML;
    state.composer.bodyText = quillInstance.getText();
    renderPreview(state);
  });
}

function personalize(template, recipient) {
  if (!template) return '';
  if (!recipient) {
    // Replace with standard fallback tags representation
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => `[${key}]`);
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return recipient[key] !== undefined ? recipient[key] : `[${key}]`;
  });
}

function renderPreview(state) {
  const frame = document.getElementById('preview-frame');
  if (!frame) return;
  
  let body = state.composer.bodyHtml || `<pre style="font-family:sans-serif;white-space:pre-wrap">${state.composer.bodyText || ''}</pre>`;
  
  // Interpolate body dynamic template placeholders using the first recipient
  const firstRecipient = state.recipients[0] || null;
  body = personalize(body, firstRecipient);

  const doc = frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;max-width:600px;color:#111}</style></head><body>${body}</body></html>`);
  doc.close();
}

function initAttachments(state) {
  const dropZone = document.getElementById('attach-drop-zone');
  const fileInput = document.getElementById('attach-file-input');

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    addFiles([...e.dataTransfer.files], state);
  });
  fileInput.addEventListener('change', e => {
    addFiles([...e.target.files], state);
    fileInput.value = '';
  });
}

function addFiles(files, state) {
  let totalSize = state.attachments.reduce((s, f) => s + f.size, 0);
  files.forEach(file => {
    state.attachments.push(file);
    totalSize += file.size;
  });

  if (totalSize > 10 * 1024 * 1024) {
    toast('WARN: PAYLOAD EXCEEDS 10MB', 'warn');
  }

  renderAttachments(state);
}

function renderAttachments(state) {
  const list = document.getElementById('attachment-list');
  const lsAttachments = document.getElementById('ls-attachments');

  if (lsAttachments) {
    lsAttachments.textContent = state.attachments.length;
  }

  if (!state.attachments.length) {
    list.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  list.classList.remove('hidden');
  list.innerHTML = state.attachments.map((f, i) => `
    <div class="attachment-item">
      <span class="attachment-name">_ ${escHtml(f.name)}</span>
      <span class="attachment-size">${Math.round(f.size/1024)} KB</span>
      <button class="btn-danger" style="padding: 0 4px; height: 20px; font-size: 10px; border:none;" data-idx="${i}">X</button>
    </div>
  `).join('');

  list.querySelectorAll('.btn-danger').forEach(btn => {
    btn.addEventListener('click', () => {
      state.attachments.splice(parseInt(btn.dataset.idx), 1);
      renderAttachments(state);
    });
  });
}

async function sendPreview(state) {
  saveCurrentContent(state);
  if (!state.smtp.user) { toast('ERR: NO SMTP USER', 'error'); return; }
  
  toast('INITIATING TEST TRANSMISSION...', 'info');
  const previewRecipient = [{ email: state.smtp.user, name: 'Preview' }];

  const fd = buildFormData(state, previewRecipient);
  try {
    const res = await fetch('/api/send', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.ok) toast('TRANSMISSION SUCCESS', 'success');
    else toast('ERR: ' + data.error, 'error');
  } catch { toast('ERR: SERVER OFFLINE', 'error'); }
}

export function buildFormData(state, recipientsOverride) {
  const fd = new FormData();
  const config = {
    smtp: state.smtp,
    recipients: recipientsOverride || state.recipients,
    fromName: state.composer.fromName,
    fromEmail: state.composer.fromEmail || state.smtp.user,
    replyTo: state.composer.replyTo,
    subject: state.composer.subject,
    bodyText: state.composer.bodyText,
    bodyHtml: state.composer.bodyHtml,
    mode: state.composer.mode,
    batchSize: 10,
    batchDelay: 1000,
  };
  fd.append('config', JSON.stringify(config));
  state.attachments.forEach(f => fd.append('attachments', f));
  return fd;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
