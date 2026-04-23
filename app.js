/* ── Config ────────────────────────────────────── */
const GIST_PREFIX = 'shoji: ';
const KEY_PAT     = 'shoji_pat';
const KEY_PREFS   = 'shoji_prefs';
const KEY_CUR_ID  = 'shoji_current_id';

const BACKGROUNDS = [
  { id: 'mist',      label: '霧', css: 'linear-gradient(140deg, #8e9eab 0%, #b4c5d0 50%, #cfd9e0 100%)' },
  { id: 'parchment', label: '紙', css: 'linear-gradient(140deg, #c9b99a 0%, #ddd0bb 50%, #e8ddd0 100%)' },
  { id: 'ink',       label: '墨', css: 'linear-gradient(140deg, #0d1117 0%, #161b22 50%, #1c2128 100%)' },
  { id: 'sakura',    label: '桜', css: 'linear-gradient(140deg, #e0a8b4 0%, #f2cdd3 50%, #fce8eb 100%)' },
  { id: 'bamboo',    label: '竹', css: 'linear-gradient(140deg, #8fa88a 0%, #b8cdb4 50%, #d4e4d0 100%)' },
  { id: 'stone',     label: '石', css: 'linear-gradient(140deg, #7a7775 0%, #a5a29f 50%, #c8c4c0 100%)' },
];

/* ── State ─────────────────────────────────────── */
let currentDocId = localStorage.getItem(KEY_CUR_ID) || null;
let isDirty      = false;
let saveTimer    = null;
let panelOpen    = false;
let loadedDocs   = [];

/* ── Helpers ───────────────────────────────────── */
const $        = id => document.getElementById(id);
const getToken = () => localStorage.getItem(KEY_PAT);
const setToken = t  => localStorage.setItem(KEY_PAT, t);
const clearToken   = () => localStorage.removeItem(KEY_PAT);

function getPrefs() {
  try { return JSON.parse(localStorage.getItem(KEY_PREFS)) || {}; }
  catch { return {}; }
}
function patchPrefs(patch) {
  localStorage.setItem(KEY_PREFS, JSON.stringify({ ...getPrefs(), ...patch }));
}

function headers() {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type':  'application/json',
    'Accept':        'application/vnd.github+json',
  };
}

function relDate(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Gist API ──────────────────────────────────── */
async function apiList() {
  const r = await fetch('https://api.github.com/gists?per_page=100', { headers: headers() });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const all = await r.json();
  return all.filter(g => g.description?.startsWith(GIST_PREFIX));
}

async function apiGet(id) {
  const r = await fetch(`https://api.github.com/gists/${id}`, { headers: headers() });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}

async function apiSave(title, content, id = null) {
  const body = JSON.stringify({
    description: `${GIST_PREFIX}${title}`,
    public: false,
    files: { 'shoji.html': { content: content || ' ' } },
  });
  const url = id
    ? `https://api.github.com/gists/${id}`
    : 'https://api.github.com/gists';
  const r = await fetch(url, { method: id ? 'PATCH' : 'POST', headers: headers(), body });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}

/* ── Auth ──────────────────────────────────────── */
function showApp() {
  $('auth-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
  applyPrefs();
  loadDocList();
}

function showAuth() {
  $('app').classList.add('hidden');
  $('auth-screen').classList.remove('hidden');
}

async function handleAuth() {
  const token = $('pat-input').value.trim();
  if (!token) return;
  const btn = $('auth-btn');
  btn.textContent = '確認中…';
  btn.disabled = true;
  try {
    const r = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error('invalid');
    setToken(token);
    showApp();
  } catch {
    btn.textContent = '始める';
    btn.disabled = false;
    const inp = $('pat-input');
    inp.style.borderColor = '#ff5f57';
    inp.placeholder = 'Token invalid — try again';
    setTimeout(() => {
      inp.style.borderColor = '';
      inp.placeholder = 'GitHub Personal Access Token';
    }, 2500);
  }
}

/* ── Documents ─────────────────────────────────── */
async function loadDocList() {
  $('doc-list').innerHTML = '<div class="doc-loading">Loading…</div>';
  try {
    loadedDocs = await apiList();
    renderDocList();
    // Auto-restore last open doc
    if (currentDocId && !$('editor').innerHTML.trim()) {
      const found = loadedDocs.find(d => d.id === currentDocId);
      if (found) openDoc(found.id, false);
    }
  } catch {
    $('doc-list').innerHTML = '<div class="doc-loading">Could not reach GitHub.</div>';
  }
}

function renderDocList() {
  const list = $('doc-list');
  if (!loadedDocs.length) {
    list.innerHTML = '<div class="doc-loading">No documents yet.</div>';
    return;
  }
  list.innerHTML = loadedDocs.map(d => {
    const title = d.description.replace(GIST_PREFIX, '');
    const active = d.id === currentDocId;
    return `<div class="doc-item${active ? ' active' : ''}" data-id="${d.id}">
      <div class="doc-item-title">${escHtml(title)}</div>
      <div class="doc-item-date">${relDate(d.updated_at)}</div>
    </div>`;
  }).join('');
  list.querySelectorAll('.doc-item').forEach(el =>
    el.addEventListener('click', () => {
      if (el.dataset.id !== currentDocId) openDoc(el.dataset.id);
    })
  );
}

async function openDoc(id, closePanel = true) {
  try {
    const gist = await apiGet(id);
    const title   = gist.description.replace(GIST_PREFIX, '');
    const content = Object.values(gist.files)[0]?.content || '';
    currentDocId = id;
    localStorage.setItem(KEY_CUR_ID, id);
    $('editor').innerHTML   = content.trim() === '' || content === ' ' ? '' : content;
    $('doc-title').textContent = title;
    setDirty(false);
    updateCounts();
    renderDocList();
    if (closePanel) togglePanel(false);
    $('editor').focus();
  } catch(e) {
    console.error('openDoc failed', e);
  }
}

async function newDoc() {
  if (isDirty) await saveNow();
  currentDocId = null;
  localStorage.removeItem(KEY_CUR_ID);
  $('editor').innerHTML = '';
  $('doc-title').textContent = 'Untitled';
  setDirty(false);
  updateCounts();
  renderDocList();
  togglePanel(false);
  $('editor').focus();
}

async function saveNow() {
  clearTimeout(saveTimer);
  const title   = $('doc-title').textContent.trim() || 'Untitled';
  const content = $('editor').innerHTML;
  try {
    const gist = await apiSave(title, content, currentDocId);
    if (!currentDocId) {
      currentDocId = gist.id;
      localStorage.setItem(KEY_CUR_ID, gist.id);
    }
    setDirty(false);
    loadedDocs = await apiList();
    renderDocList();
  } catch(e) {
    console.error('Save failed', e);
  }
}

function setDirty(v) {
  isDirty = v;
  $('save-dot').style.visibility = v ? 'visible' : 'hidden';
}

function scheduleSave() {
  setDirty(true);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 2500);
}

function updateCounts() {
  const text  = $('editor').innerText || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.replace(/\s/g, '').length;
  $('word-count').textContent = `${words} word${words !== 1 ? 's' : ''}`;
  $('char-count').textContent = `${chars} chars`;
}

/* ── Panel ─────────────────────────────────────── */
function togglePanel(force) {
  panelOpen = force !== undefined ? force : !panelOpen;
  $('panel').classList.toggle('visible', panelOpen);
}

/* ── Preferences ───────────────────────────────── */
function applyPrefs() {
  const p = getPrefs();
  // Background
  applyBg(p.bg || 'mist', p.customBgUrl || '');
  // Font size
  const sz = p.fontSize || 16;
  document.documentElement.style.setProperty('--font-size', `${sz}px`);
  $('font-size-slider').value = sz;
  $('font-size-val').textContent = `${sz}px`;
  // Dark glass
  $('window').classList.toggle('dark-glass', !!p.darkGlass);
  $('dark-glass-toggle').checked = !!p.darkGlass;
  // Build bg swatches
  buildBgGrid(p.bg || 'mist');
  // Custom bg input
  if (p.customBgUrl) $('custom-bg-url').value = p.customBgUrl;
}

function applyBg(id, customUrl) {
  const desktop = $('desktop');
  if (customUrl) {
    desktop.style.background = `url(${CSS.escape ? customUrl : customUrl}) center/cover no-repeat`;
    return;
  }
  const bg = BACKGROUNDS.find(b => b.id === id);
  if (bg) desktop.style.background = bg.css;
}

function buildBgGrid(selectedId) {
  const grid = $('bg-grid');
  grid.innerHTML = BACKGROUNDS.map(bg =>
    `<div class="bg-swatch${bg.id === selectedId ? ' selected' : ''}" data-bg="${bg.id}" style="background:${bg.css}">
       <div class="bg-swatch-label">${bg.label}</div>
     </div>`
  ).join('');
  grid.querySelectorAll('.bg-swatch').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.bg;
      $('custom-bg-url').value = '';
      patchPrefs({ bg: id, customBgUrl: '' });
      applyBg(id, '');
      grid.querySelectorAll('.bg-swatch').forEach(s => s.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}

/* ── Init ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.execCommand('defaultParagraphSeparator', false, 'div');

  /* Auth */
  $('auth-btn').addEventListener('click', handleAuth);
  $('pat-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleAuth(); });

  /* Window controls */
  $('panel-btn').addEventListener('click', () => togglePanel());
  $('btn-close').addEventListener('click', newDoc);
  $('btn-min').addEventListener('click', () => togglePanel(false));
  $('btn-max').addEventListener('click', () => {
    $('window').classList.toggle('focus-mode');
  });

  /* Editor */
  $('editor').addEventListener('input', () => {
    updateCounts();
    scheduleSave();
  });

  /* Title */
  $('doc-title').addEventListener('blur', () => {
    if ($('doc-title').textContent.trim()) scheduleSave();
  });
  $('doc-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('doc-title').blur();
      $('editor').focus();
    }
  });

  /* Panel tabs */
  document.querySelectorAll('.ptab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      $(`tab-${tab.dataset.tab}`).classList.remove('hidden');
    });
  });

  /* Doc actions */
  $('new-doc-btn').addEventListener('click', newDoc);

  /* Settings */
  $('font-size-slider').addEventListener('input', e => {
    const sz = e.target.value;
    document.documentElement.style.setProperty('--font-size', `${sz}px`);
    $('font-size-val').textContent = `${sz}px`;
    patchPrefs({ fontSize: +sz });
  });

  $('dark-glass-toggle').addEventListener('change', e => {
    $('window').classList.toggle('dark-glass', e.target.checked);
    patchPrefs({ darkGlass: e.target.checked });
  });

  $('custom-bg-url').addEventListener('change', e => {
    const url = e.target.value.trim();
    if (url) {
      patchPrefs({ customBgUrl: url, bg: 'custom' });
      applyBg('custom', url);
      document.querySelectorAll('.bg-swatch').forEach(s => s.classList.remove('selected'));
    }
  });

  $('sign-out-btn').addEventListener('click', () => {
    if (confirm('Sign out? Your documents stay saved on GitHub.')) {
      clearToken();
      localStorage.removeItem(KEY_CUR_ID);
      showAuth();
    }
  });

  /* Keyboard shortcuts */
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveNow();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      togglePanel();
    }
    if (e.key === 'Escape' && panelOpen) {
      togglePanel(false);
    }
  });

  /* Boot */
  if (getToken()) {
    showApp();
  } else {
    showAuth();
  }
});
