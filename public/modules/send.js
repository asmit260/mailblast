/**
 * send.js — Send engine, progress, log, summary
 */
import { toast } from './toast.js';
import { buildFormData } from './composer.js';

export function initSend(state) {
  document.getElementById('btn-initiate-transmission').addEventListener('click', () => startSend(state));
  
  let paused = false;
  document.getElementById('btn-pause').addEventListener('click', async () => {
    paused = !paused;
    const action = paused ? 'pause' : 'resume';
    await fetch('/api/stop', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action }) });
    document.getElementById('btn-pause').textContent = paused ? '[ RESUME ]' : '[ PAUSE ]';
  });

  document.getElementById('btn-stop').addEventListener('click', async () => {
    if (!confirm('ABORT TRANSMISSION?')) return;
    await fetch('/api/stop', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'stop' }) });
    toast('TRANSMISSION ABORTED.', 'warn');
  });

  document.getElementById('btn-download-report').addEventListener('click', () => downloadReport(state));
  document.getElementById('btn-retry-failed').addEventListener('click', () => retryFailed(state));
  
  document.getElementById('btn-new-campaign').addEventListener('click', () => {
    // Reset wizard step
    if (window.goToWizardStep) window.goToWizardStep(1);

    // Reset wizard step 5 screens
    document.getElementById('success-screen').classList.add('hidden');
    document.getElementById('sending-screen').classList.add('hidden');
    document.getElementById('launch-screen').classList.remove('hidden');

    // Reset relevant recipient state
    state.recipients = [];
    state.attachments = [];
    document.getElementById('attachment-list').innerHTML = '';
    document.getElementById('attachment-list').classList.add('hidden');

    // Reset compose text fields
    document.getElementById('subject').value = '';
    document.getElementById('preview-text').value = '';
    document.getElementById('from-name').value = '';
    document.getElementById('from-email').value = '';
    document.getElementById('reply-to').value = '';
    document.getElementById('body-text').value = '';
    document.getElementById('html-source').value = '';

    // Clear recipient counters and lists
    const list = document.getElementById('recipient-list');
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon" style="font-size: var(--t-xs); font-family: var(--font-mono); color: var(--text-secondary); border: 1px dashed var(--border); padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">EMPTY</span>
        <span class="empty-state-text">No recipients imported</span>
        <span class="empty-state-hint">Upload a CSV or manually add recipients</span>
      </div>
    `;
    const count = document.getElementById('recipient-count');
    const queueCount = document.getElementById('queue-global-count');
    const validDisplay = document.getElementById('recipient-valid-count');
    const invalidDisplay = document.getElementById('recipient-invalid-count');
    if (count) count.textContent = '0';
    if (queueCount) queueCount.textContent = '0';
    if (validDisplay) validDisplay.textContent = '0';
    if (invalidDisplay) invalidDisplay.textContent = '0';

    // Reset composer state
    state.composer = {
      fromName: '', fromEmail: '', replyTo: '',
      subject: '', bodyText: '', bodyHtml: '', mode: 'text'
    };

    // Reset progress and log outputs
    document.getElementById('log-output').innerHTML = '';
    
    toast('New campaign initialized!', 'success');
  });
}

async function startSend(state) {
  const batchSize  = parseInt(document.getElementById('batch-size').value, 10)  || 10;
  const batchDelay = parseInt(document.getElementById('batch-delay').value, 10) || 1000;

  state.job = { running: true, paused: false, total: state.recipients.length, sent: 0, failed: 0, results: [] };

  document.getElementById('launch-screen').classList.add('hidden');
  document.getElementById('sending-screen').classList.remove('hidden');
  resetProgress(state);

  const fd = buildFormData(state, null);
  const config = JSON.parse(fd.get('config'));
  config.batchSize  = batchSize;
  config.batchDelay = batchDelay;
  fd.set('config', JSON.stringify(config));

  try {
    const res  = await fetch('/api/send', { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.ok) { toast('ERR: ' + data.error, 'error'); return; }
  } catch { toast('ERR: SERVER UNREACHABLE', 'error'); return; }

  connectSSE(state);
}

let _logLines = [];

function connectSSE(state) {
  const es = new EventSource('/api/progress');

  es.addEventListener('start', e => {
    const d = JSON.parse(e.data);
    state.job.total = d.total;
    appendLog('> Transmission started', 'text-green');
  });

  es.addEventListener('progress', e => {
    const d = JSON.parse(e.data);
    state.job.sent   = d.sent;
    state.job.failed = d.failed;
    state.job.results.push({ email: d.email, status: d.status, duration: d.duration, error: d.error });
    updateProgress(d, state);
    appendLog(`> ${d.status === 'sent' ? 'OK' : 'ERR'} - ${d.email} - ${d.status === 'sent' ? d.duration+'ms' : d.error}`, d.status === 'sent' ? 'text-primary' : 'text-red');
  });

  es.addEventListener('done', e => {
    const d = JSON.parse(e.data);
    es.close();
    state.job.running = false;
    appendLog('> Transmission complete', 'text-green');
    showSummary(state);
  });

  es.addEventListener('stopped', () => {
    es.close();
    state.job.running = false;
    appendLog('> Transmission aborted', 'text-amber');
  });

  es.addEventListener('error', () => {
    if (es.readyState === EventSource.CLOSED) return;
    toast('ERR: SSE CONNECTION LOST', 'warn');
  });
}

let _speedSamples = [];
let _lastTime = Date.now();
let _startTime = Date.now();

function resetProgress(state) {
  _speedSamples = [];
  _lastTime = Date.now();
  _startTime = Date.now();
  _logLines = [];
  document.getElementById('progress-label-text').textContent = `0 / ${state.job.total} sent`;
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-pct').textContent = '0%';
  document.getElementById('stat-sent').textContent = '0';
  document.getElementById('stat-remaining').textContent = state.job.total;
  document.getElementById('stat-failed').textContent = '0';
  document.getElementById('progress-eta').textContent = '—';
  document.getElementById('progress-speed').textContent = '—';
  document.getElementById('log-output').innerHTML = '';
}

function updateProgress(d, state) {
  const pct = (d.index + 1) / state.job.total;
  
  // Update UI Progress Bar
  document.getElementById('progress-label-text').textContent = `${d.index + 1} / ${state.job.total} sent`;
  document.getElementById('progress-fill').style.width = Math.round(pct * 100) + '%';
  document.getElementById('progress-pct').textContent = Math.round(pct * 100) + '%';
  
  document.getElementById('stat-sent').textContent    = d.sent;
  document.getElementById('stat-remaining').textContent = state.job.total - d.index - 1;
  document.getElementById('stat-failed').textContent  = d.failed;
  
  // Speed / ETA
  const now = Date.now();
  const elapsed = (now - _lastTime) / 1000;
  _lastTime = now;
  if (elapsed > 0) _speedSamples.push(1 / elapsed);
  if (_speedSamples.length > 10) _speedSamples.shift();
  const avgSpeed = _speedSamples.reduce((a, b) => a + b, 0) / _speedSamples.length;
  const remaining = state.job.total - d.index - 1;
  const etaSec = avgSpeed > 0 ? Math.round(remaining / avgSpeed) : 0;

  document.getElementById('progress-speed').textContent = `~${avgSpeed.toFixed(1)}/s`;
  document.getElementById('progress-eta').textContent = etaSec > 0 ? formatTime(etaSec) : '—';
}

function formatTime(sec) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec/60)}m ${sec%60}s`;
}

function appendLog(msg, colorClass) {
  const logEl = document.getElementById('log-panel');
  const output = document.getElementById('log-output');
  const isAtBottom = logEl.scrollHeight - logEl.clientHeight <= logEl.scrollTop + 10;
  
  const line = document.createElement('div');
  line.className = `log-line ${colorClass}`;
  line.textContent = msg;
  output.appendChild(line);
  
  if (isAtBottom) logEl.scrollTop = logEl.scrollHeight;
}

function showSummary(state) {
  setTimeout(() => {
    document.getElementById('sending-screen').classList.add('hidden');
    document.getElementById('success-screen').classList.remove('hidden');
    
    document.getElementById('final-sent').textContent = state.job.sent;
    document.getElementById('final-failed').textContent = state.job.failed;
    
    const totalAttempted = state.job.sent + state.job.failed;
    let rate = '—';
    if (totalAttempted > 0) {
      rate = Math.round((state.job.sent / totalAttempted) * 100) + '%';
    }
    document.getElementById('final-rate').textContent = rate;

    const durationSec = Math.floor((Date.now() - _startTime) / 1000);
    document.getElementById('final-duration').textContent = formatTime(durationSec);
    
    const failSection = document.getElementById('summary-failed-section');
    if (state.job.failed > 0) {
      failSection.classList.remove('hidden');
    } else {
      failSection.classList.add('hidden');
    }
  }, 1000);
}

function retryFailed(state) {
  const failed = state.job.results.filter(r => r.status === 'failed');
  state.recipients = failed.map(f => ({ email: f.email }));
  document.getElementById('success-screen').classList.add('hidden');
  document.getElementById('launch-screen').classList.remove('hidden');
  
  if (window.goToWizardStep) {
    window.goToWizardStep(2); // Jump back to audience to show the new list
  }
  
  toast(`RE-QUEUED ${failed.length} ADDRESSES`, 'info');
}

function downloadReport(state) {
  if (!state.job.results.length) { toast('NO DATA', 'warn'); return; }
  const csv = 'Email,Status,Duration,Error\n' + state.job.results.map(r =>
    `${r.email},${r.status},${r.duration || ''},${r.error || ''}`
  ).join('\n');
  
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'mail_exe_report.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
