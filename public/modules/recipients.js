/**
 * recipients.js — Recipient management
 * Manual paste, CSV upload (PapaParse), Excel upload (SheetJS)
 * Pagination and debounced search to avoid DOM bloat and lagging.
 */
import { toast } from './toast.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let currentPage = 1;
const itemsPerPage = 50;
let searchQuery = '';

export function initRecipients(state) {
  // Tab switching
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn[data-tab]').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(`pane-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Paste (Manually Add)
  document.getElementById('btn-load-paste').addEventListener('click', () => {
    const raw = document.getElementById('paste-input').value;
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const rows = [];

    lines.forEach(line => {
      // Split line by comma
      const parts = line.split(',').map(p => p.trim());
      // Identify email column
      const emailIdx = parts.findIndex(p => EMAIL_RE.test(p));
      
      if (emailIdx !== -1) {
        const email = parts[emailIdx];
        parts.splice(emailIdx, 1); // remove email from candidate name/company columns
        const name = parts[0] || '';
        const company = parts[1] || '';
        rows.push({ email, name, company });
      } else {
        // Fallback: If no comma, check if entire line is an email
        if (EMAIL_RE.test(line)) {
          rows.push({ email: line, name: '', company: '' });
        }
      }
    });

    loadEmails(rows, state);
    document.getElementById('paste-input').value = ''; // clear input after load
  });

  // CSV
  const csvDrop = document.getElementById('csv-drop-zone');
  const csvFile = document.getElementById('csv-file-input');
  setupDropZone(csvDrop, csvFile, handleCsvFile, state);
  csvFile.addEventListener('change', e => { if (e.target.files[0]) handleCsvFile(e.target.files[0], state); });
  document.getElementById('btn-apply-csv').addEventListener('click', () => applyCsvMapping(state));

  // Excel
  const xlDrop = document.getElementById('excel-drop-zone');
  const xlFile = document.getElementById('excel-file-input');
  setupDropZone(xlDrop, xlFile, handleExcelFile, state);
  xlFile.addEventListener('change', e => { if (e.target.files[0]) handleExcelFile(e.target.files[0], state); });
  document.getElementById('btn-apply-excel').addEventListener('click', () => applyExcelMapping(state));

  // Clear
  document.getElementById('btn-clear-recipients').addEventListener('click', () => {
    state.recipients = [];
    currentPage = 1;
    searchQuery = '';
    const searchInput = document.getElementById('recipient-search');
    if (searchInput) searchInput.value = '';
    
    const validDisplay = document.getElementById('recipient-valid-count');
    const invalidDisplay = document.getElementById('recipient-invalid-count');
    if (validDisplay) validDisplay.textContent = 0;
    if (invalidDisplay) invalidDisplay.textContent = 0;

    renderRecipientList(state);
    toast('MEMORY CLEARED', 'info');
  });

  // Pagination buttons
  const prevBtn = document.getElementById('btn-page-prev');
  const nextBtn = document.getElementById('btn-page-next');
  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderRecipientList(state);
      }
    });
    nextBtn.addEventListener('click', () => {
      const filtered = getFilteredRecipients(state);
      const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
      if (currentPage < totalPages) {
        currentPage++;
        renderRecipientList(state);
      }
    });
  }

  // Search filter
  const searchInput = document.getElementById('recipient-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = searchInput.value;
        currentPage = 1;
        renderRecipientList(state);
      }, 150);
    });
  }
}

function getFilteredRecipients(state) {
  const q = searchQuery.toLowerCase().trim();
  if (!q) return state.recipients;
  return state.recipients.filter(r => {
    const email = (r.email || '').toLowerCase();
    const name = (r.name || '').toLowerCase();
    const company = (r.company || '').toLowerCase();
    return email.includes(q) || name.includes(q) || company.includes(q);
  });
}

function loadEmails(rows, state) {
  const valid = [], invalid = [], dupes = [];
  const seen = new Set(state.recipients.map(r => r.email.toLowerCase()));

  rows.forEach(row => {
    const email = (row.email || '').trim();
    if (!EMAIL_RE.test(email)) { invalid.push(email); return; }
    if (seen.has(email.toLowerCase())) { dupes.push(email); return; }
    seen.add(email.toLowerCase());
    
    // Assign persistent unique ID
    if (!row.id) {
      row.id = Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }
    valid.push(row);
  });

  state.recipients.push(...valid);

  // Update validity stats
  const validDisplay = document.getElementById('recipient-valid-count');
  const invalidDisplay = document.getElementById('recipient-invalid-count');
  if (validDisplay) validDisplay.textContent = parseInt(validDisplay.textContent || '0') + valid.length;
  if (invalidDisplay) invalidDisplay.textContent = parseInt(invalidDisplay.textContent || '0') + invalid.length;

  renderRecipientList(state);

  const msgs = [];
  if (valid.length)   msgs.push(`✓ ${valid.length} LOADED`);
  if (dupes.length)   msgs.push(`${dupes.length} DUPES`);
  if (invalid.length) msgs.push(`${invalid.length} INVALID`);
  toast(msgs.join(' | '), invalid.length ? 'warn' : 'success');
}

// ── CSV handling ──
let _csvData = null;

async function handleCsvFile(file, state) {
  if (!window.Papa) await loadScript('/lib/papaparse.min.js');
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete(result) {
      _csvData = result.data;
      const cols = result.meta.fields || [];
      showColumnMapping('csv', cols);
      toast(`CSV PARSED: ${result.data.length} ROWS`, 'success');
    },
    error(err) { toast(`CSV ERR: ${err.message}`, 'error'); }
  });
}

function showColumnMapping(type, cols) {
  const emailSel = document.getElementById(`${type}-email-col`);
  const nameSel  = document.getElementById(`${type}-name-col`);
  emailSel.innerHTML = cols.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
  nameSel.innerHTML  = `<option value="">-- none --</option>` + cols.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');

  const emailGuess = cols.find(c => /email|e-mail|mail/i.test(c));
  if (emailGuess) emailSel.value = emailGuess;
  const nameGuess = cols.find(c => /^name$|first.?name|full.?name/i.test(c));
  if (nameGuess) nameSel.value = nameGuess;

  document.getElementById(`${type}-mapping`).classList.remove('hidden');
}

function applyCsvMapping(state) {
  if (!_csvData) return;
  const emailCol = document.getElementById('csv-email-col').value;
  const nameCol  = document.getElementById('csv-name-col').value;
  const rows = _csvData.map(row => ({ ...row, email: row[emailCol] || '', name: nameCol ? row[nameCol] : '' }));
  loadEmails(rows, state);
}

// ── Excel handling ──
let _xlWorkbook = null;

async function handleExcelFile(file, state) {
  if (!window.XLSX) await loadScript('/lib/xlsx.min.js');
  const buf = await file.arrayBuffer();
  _xlWorkbook = XLSX.read(buf, { type: 'buffer' });
  const sheets = _xlWorkbook.SheetNames;

  const sheetSel = document.getElementById('excel-sheet');
  sheetSel.innerHTML = sheets.map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
  document.getElementById('excel-sheet-select').classList.remove('hidden');

  sheetSel.addEventListener('change', () => populateExcelMapping(), { once: false });
  populateExcelMapping();
  toast(`XLSX OPENED: ${sheets.length} SHEET(S)`, 'success');
}

function populateExcelMapping() {
  if (!_xlWorkbook) return;
  const sheet = _xlWorkbook.Sheets[document.getElementById('excel-sheet').value];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const cols = (data[0] || []).map(String);
  showColumnMapping('excel', cols);
}

function applyExcelMapping(state) {
  if (!_xlWorkbook) return;
  const sheetName  = document.getElementById('excel-sheet').value;
  const emailCol   = document.getElementById('excel-email-col').value;
  const nameCol    = document.getElementById('excel-name-col').value;
  const sheet      = _xlWorkbook.Sheets[sheetName];
  const data       = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const rows = data.map(row => ({ ...row, email: row[emailCol] || '', name: nameCol ? row[nameCol] : '' }));
  loadEmails(rows, state);
}

// ── Render recipient list ──
export function renderRecipientList(state) {
  const list  = document.getElementById('recipient-list');
  const count = document.getElementById('recipient-count');
  const queueCount = document.getElementById('queue-global-count');
  
  const total = state.recipients.length;
  if (count) count.textContent = total;
  if (queueCount) queueCount.textContent = total;
  
  const filtered = getFilteredRecipients(state);
  const totalFiltered = filtered.length;
  
  const validDisplay = document.getElementById('recipient-valid-count');
  const invalidDisplay = document.getElementById('recipient-invalid-count');
  
  if (total === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon" style="font-size: var(--t-xs); font-family: var(--font-mono); color: var(--text-secondary); border: 1px dashed var(--border); padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">EMPTY</span>
        <span class="empty-state-text">No recipients imported</span>
        <span class="empty-state-hint">Upload a CSV or manually add recipients</span>
      </div>
    `;
    if (validDisplay) validDisplay.textContent = 0;
    if (invalidDisplay) invalidDisplay.textContent = 0;
    const pagPanel = document.getElementById('recipient-pagination');
    if (pagPanel) pagPanel.style.display = 'none';
    return;
  }

  // Calculate Pages
  const totalPages = Math.ceil(totalFiltered / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pageItems = filtered.slice(startIdx, endIdx);

  // Update Pagination Controls UI
  const pagPanel = document.getElementById('recipient-pagination');
  if (pagPanel) {
    if (totalFiltered > itemsPerPage) {
      pagPanel.style.display = 'flex';
      document.getElementById('page-indicator').textContent = `Page ${currentPage} of ${totalPages} (${totalFiltered} total)`;
      document.getElementById('btn-page-prev').disabled = currentPage === 1;
      document.getElementById('btn-page-next').disabled = currentPage === totalPages;
    } else {
      pagPanel.style.display = 'none';
    }
  }

  if (pageItems.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-text">No matching recipients found</span>
      </div>
    `;
    return;
  }

  list.innerHTML = pageItems.map(r => `
    <div class="recipient-item">
      <span>${escHtml(r.email)}${r.name ? ` <span class="text-muted">(${escHtml(r.name)}${r.company ? ` @ ${escHtml(r.company)}` : ''})</span>` : ''}</span>
      <button class="btn-danger" style="padding: 0 4px; height: 20px; font-size: 10px; border:none;" data-id="${r.id}">X</button>
    </div>
  `).join('');

  // Splicing via Unique ID (Fixes Index Drift Bug)
  list.querySelectorAll('.btn-danger').forEach(btn => {
    btn.addEventListener('click', () => {
      const idToDelete = btn.dataset.id;
      const idx = state.recipients.findIndex(rec => rec.id === idToDelete);
      if (idx !== -1) {
        state.recipients.splice(idx, 1);
        
        // Decrement local valid count dynamically
        if (validDisplay) {
          validDisplay.textContent = Math.max(0, parseInt(validDisplay.textContent || '0') - 1);
        }
        
        renderRecipientList(state);
        toast('RECIPIENT REMOVED', 'info');
      }
    });
  });
}

function setupDropZone(zone, input, handler, state) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) { zone.classList.add('loaded'); handler(file, state); }
  });
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
