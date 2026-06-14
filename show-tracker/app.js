const RIDERS_KEY = 'showTracker.riders';
const HISTORY_KEY = 'showTracker.history';

const STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

// ── Storage helpers ────────────────────────────────────────
function loadRiders() {
  try {
    const data = JSON.parse(localStorage.getItem(RIDERS_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveRiders(riders) {
  localStorage.setItem(RIDERS_KEY, JSON.stringify(riders));
}

function loadHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

// ── State ──────────────────────────────────────────────────
let riders = loadRiders();
let history = loadHistory();
let lastMatches = null;
let lastContext = null;

// ── Elements ───────────────────────────────────────────────
const riderForm = document.getElementById('rider-form');
const riderInput = document.getElementById('rider-input');
const riderList = document.getElementById('rider-list');

const showDate = document.getElementById('show-date');
const showState = document.getElementById('show-state');
const showName = document.getElementById('show-name');

const pasteZone = document.getElementById('paste-zone');
const findRidersBtn = document.getElementById('find-riders-btn');
const clearPasteBtn = document.getElementById('clear-paste-btn');

const resultsSection = document.getElementById('results-section');
const resultsContext = document.getElementById('results-context');
const resultsOutput = document.getElementById('results-output');
const saveEntryBtn = document.getElementById('save-entry-btn');

const historyList = document.getElementById('history-list');
const historyEmptyHint = document.getElementById('history-empty-hint');

// ── Init ───────────────────────────────────────────────────
function init() {
  populateStates();
  showDate.valueAsDate = new Date();
  renderRiders();
  renderHistory();

  riderForm.addEventListener('submit', onAddRider);
  riderList.addEventListener('click', onRiderListClick);
  findRidersBtn.addEventListener('click', onFindRiders);
  clearPasteBtn.addEventListener('click', () => { pasteZone.innerHTML = ''; });
  saveEntryBtn.addEventListener('click', onSaveEntry);
  historyList.addEventListener('click', onHistoryListClick);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
}

function populateStates() {
  for (const [abbr, name] of STATES) {
    const opt = document.createElement('option');
    opt.value = abbr;
    opt.textContent = `${name} (${abbr})`;
    showState.appendChild(opt);
  }
}

// ── Riders ─────────────────────────────────────────────────
function onAddRider(e) {
  e.preventDefault();
  const name = riderInput.value.trim().replace(/\s+/g, ' ');
  if (!name) return;
  const exists = riders.some(r => r.toLowerCase() === name.toLowerCase());
  if (!exists) {
    riders.push(name);
    saveRiders(riders);
    renderRiders();
  }
  riderInput.value = '';
  riderInput.focus();
}

function onRiderListClick(e) {
  const btn = e.target.closest('button.remove');
  if (!btn) return;
  const name = btn.dataset.name;
  riders = riders.filter(r => r !== name);
  saveRiders(riders);
  renderRiders();
}

function renderRiders() {
  riderList.innerHTML = '';
  if (riders.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-msg';
    li.textContent = 'No riders added yet.';
    riderList.appendChild(li);
    return;
  }
  for (const name of riders) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = name;
    const btn = document.createElement('button');
    btn.className = 'remove';
    btn.type = 'button';
    btn.dataset.name = name;
    btn.setAttribute('aria-label', `Remove ${name}`);
    btn.textContent = '×';
    li.appendChild(span);
    li.appendChild(btn);
    riderList.appendChild(li);
  }
}

// ── Parsing pasted content ────────────────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rowMatchesRider(rowText, riderName) {
  const text = rowText.toLowerCase();
  const words = riderName.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every(word => new RegExp(`\\b${escapeRegex(word)}\\b`).test(text));
}

function parsePasteZone(el) {
  const tables = el.querySelectorAll('table');
  if (tables.length > 0) {
    return Array.from(tables).map(parseTable).filter(t => t.rows.length > 0);
  }
  const text = el.textContent || '';
  return [parseLines(text)];
}

function parseTable(table) {
  const allRows = Array.from(table.querySelectorAll('tr')).map(tr =>
    Array.from(tr.children).map(cell => cell.textContent.trim().replace(/\s+/g, ' '))
  ).filter(row => row.some(cell => cell.length > 0));

  if (allRows.length === 0) return { headers: [], rows: [] };

  const headers = allRows[0];
  const rows = allRows.slice(1);
  return { headers, rows };
}

function parseLines(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const splitRows = lines.map(line => {
    const cols = line.split(/\t+| {2,}/).map(c => c.trim()).filter(c => c.length > 0);
    return cols.length > 1 ? cols : [line];
  });
  const maxCols = splitRows.reduce((max, r) => Math.max(max, r.length), 1);
  const headers = maxCols > 1
    ? Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`)
    : ['Details'];
  return { headers, rows: splitRows };
}

function findRiderMatches(parsedTables, riderNames) {
  const matches = {};
  for (const rider of riderNames) matches[rider] = [];

  for (const table of parsedTables) {
    const byRider = {};
    for (const row of table.rows) {
      const rowText = row.join(' ');
      for (const rider of riderNames) {
        if (rowMatchesRider(rowText, rider)) {
          (byRider[rider] = byRider[rider] || []).push(row);
        }
      }
    }
    for (const [rider, rows] of Object.entries(byRider)) {
      matches[rider].push({ headers: table.headers, rows });
    }
  }
  return matches;
}

// ── Find My Riders ─────────────────────────────────────────
function onFindRiders() {
  if (riders.length === 0) {
    alert('Add at least one rider name first.');
    return;
  }
  const text = (pasteZone.textContent || '').trim();
  if (!text) {
    alert('Paste a schedule or results table first.');
    return;
  }

  const parsedTables = parsePasteZone(pasteZone);
  const matches = findRiderMatches(parsedTables, riders);

  lastMatches = matches;
  lastContext = {
    date: showDate.value,
    state: showState.value,
    showName: showName.value.trim(),
  };

  renderResults(matches, lastContext);
}

function renderResults(matches, context) {
  resultsOutput.innerHTML = '';

  for (const rider of riders) {
    const groups = matches[rider] || [];
    const card = document.createElement('div');
    card.className = 'rider-result';

    const h3 = document.createElement('h3');
    h3.textContent = rider;
    card.appendChild(h3);

    if (groups.length === 0) {
      const p = document.createElement('p');
      p.className = 'no-match';
      p.textContent = 'No entries found in the pasted data.';
      card.appendChild(p);
    } else {
      for (const group of groups) {
        card.appendChild(renderMatchTable(group.headers, group.rows));
      }
    }
    resultsOutput.appendChild(card);
  }

  resultsContext.textContent = formatContext(context);
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderMatchTable(headers, rows) {
  const wrap = document.createElement('div');
  wrap.className = 'match-table-wrap';
  const table = document.createElement('table');
  table.className = 'match-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const h of headers) {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (let i = 0; i < headers.length; i++) {
      const td = document.createElement('td');
      td.textContent = row[i] || '';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  wrap.appendChild(table);
  return wrap;
}

function formatContext(context) {
  const parts = [];
  if (context.date) {
    const [y, m, d] = context.date.split('-').map(Number);
    parts.push(new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
  }
  if (context.state) parts.push(context.state);
  if (context.showName) parts.push(context.showName);
  return parts.length > 0 ? parts.join(' – ') : 'this show';
}

// ── History ────────────────────────────────────────────────
function onSaveEntry() {
  if (!lastMatches || !lastContext) return;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    date: lastContext.date,
    state: lastContext.state,
    showName: lastContext.showName,
    matches: lastMatches,
    riders: [...riders],
  };
  history.unshift(entry);
  saveHistory(history);
  renderHistory();
}

function onHistoryListClick(e) {
  const btn = e.target.closest('button.delete-entry');
  if (!btn) return;
  const id = btn.dataset.id;
  history = history.filter(entry => entry.id !== id);
  saveHistory(history);
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';
  historyEmptyHint.hidden = history.length > 0;

  for (const entry of history) {
    const li = document.createElement('li');
    li.className = 'history-entry';

    const details = document.createElement('details');
    const summary = document.createElement('summary');

    const label = document.createElement('span');
    label.textContent = formatContext(entry);
    summary.appendChild(label);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-entry';
    delBtn.type = 'button';
    delBtn.dataset.id = entry.id;
    delBtn.textContent = 'Remove';
    summary.appendChild(delBtn);

    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'entry-body';
    const entryRiders = entry.riders && entry.riders.length > 0 ? entry.riders : Object.keys(entry.matches || {});
    for (const rider of entryRiders) {
      const groups = (entry.matches && entry.matches[rider]) || [];
      const card = document.createElement('div');
      card.className = 'rider-result';
      const h3 = document.createElement('h3');
      h3.textContent = rider;
      card.appendChild(h3);
      if (groups.length === 0) {
        const p = document.createElement('p');
        p.className = 'no-match';
        p.textContent = 'No entries found in the pasted data.';
        card.appendChild(p);
      } else {
        for (const group of groups) {
          card.appendChild(renderMatchTable(group.headers, group.rows));
        }
      }
      body.appendChild(card);
    }
    details.appendChild(body);

    li.appendChild(details);
    historyList.appendChild(li);
  }
}

init();
