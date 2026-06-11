/**
 * send.js — Send engine, progress, log, summary
 */
import { toast } from './toast.js';
import { buildFormData } from './composer.js';

export function initSend(state) {
  document.getElementById('btn-initiate-transmission').addEventListener('click', () => startSend(state));
  
  document.getElementById('btn-pause').addEventListener('click', () => {
    if (!state.job) return;
    state.job.paused = !state.job.paused;
    document.getElementById('btn-pause').textContent = state.job.paused ? '[ RESUME ]' : '[ PAUSE ]';
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    if (!state.job) return;
    if (!confirm('ABORT TRANSMISSION?')) return;
    state.job.stopped = true;
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

  state.job = { running: true, paused: false, stopped: false, total: state.recipients.length, sent: 0, failed: 0, results: [] };

  document.getElementById('launch-screen').classList.add('hidden');
  document.getElementById('sending-screen').classList.remove('hidden');
  resetProgress(state);
  
  appendLog('> Transmission started', 'text-green');

  const allRecipients = state.recipients;
  let globalIndex = 0;

  for (let i = 0; i < allRecipients.length; i += batchSize) {
    if (state.job.stopped) {
      appendLog('> Transmission aborted', 'text-amber');
      break;
    }

    while (state.job.paused && !state.job.stopped) {
      await new Promise(r => setTimeout(r, 500));
    }
    
    if (state.job.stopped) {
      appendLog('> Transmission aborted', 'text-amber');
      break;
    }

    const currentBatch = allRecipients.slice(i, i + batchSize);

    // Build form data for just this batch
    const fd = buildFormData(state, null);
    const config = JSON.parse(fd.get('config'));
    config.recipients = currentBatch;
    fd.set('config', JSON.stringify(config));

    try {
      const res  = await fetch('/api/send', { method: 'POST', body: fd });
      const data = await res.json();
      
      if (!data.ok) {
        toast('ERR: ' + data.error, 'error');
        appendLog('> ERR: ' + data.error, 'text-red');
        break;
      }

      // Process results
      data.results.forEach((r, idx) => {
        state.job.results.push(r);
        if (r.status === 'sent') state.job.sent++;
        else state.job.failed++;
        
        updateProgress(globalIndex + idx, state);
        appendLog(`> ${r.status === 'sent' ? 'OK' : 'ERR'} - ${r.email} - ${r.status === 'sent' ? r.duration+'ms' : r.error}`, r.status === 'sent' ? 'text-primary' : 'text-red');
      });

    } catch (err) {
      toast('ERR: SERVER UNREACHABLE', 'error');
      appendLog('> ERR: SERVER UNREACHABLE - ' + err.message, 'text-red');
      break;
    }

    globalIndex += currentBatch.length;

    if (i + batchSize < allRecipients.length && !state.job.stopped) {
      await new Promise(r => setTimeout(r, batchDelay));
    }
  }

  state.job.running = false;
  if (!state.job.stopped) {
    appendLog('> Transmission complete', 'text-green');
  }
  showSummary(state);
}

let _logLines = [];

let _startTime = Date.now();

function resetProgress(state) {
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

function updateProgress(currentIndex, state) {
  const pct = (currentIndex + 1) / state.job.total;
  
  // Update UI Progress Bar
  document.getElementById('progress-label-text').textContent = `${currentIndex + 1} / ${state.job.total} sent`;
  document.getElementById('progress-fill').style.width = Math.round(pct * 100) + '%';
  document.getElementById('progress-pct').textContent = Math.round(pct * 100) + '%';
  
  document.getElementById('stat-sent').textContent    = state.job.sent;
  document.getElementById('stat-remaining').textContent = state.job.total - currentIndex - 1;
  document.getElementById('stat-failed').textContent  = state.job.failed;
  
  // Speed / ETA
  const now = Date.now();
  const elapsedTotal = (now - _startTime) / 1000;
  const completed = currentIndex + 1;
  
  const avgSpeed = elapsedTotal > 0 ? (completed / elapsedTotal) : 0;
  const remaining = state.job.total - completed;
  const etaSec = avgSpeed > 0 ? Math.round(remaining / avgSpeed) : 0;

  document.getElementById('progress-speed').textContent = avgSpeed > 0 ? `~${avgSpeed.toFixed(1)}/s` : '—';
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
