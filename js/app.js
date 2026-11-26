/* App core: state, autosave, routing, home, sessions, settings store. */
(function () {
  const { DB, newSession, newPatient, status } = OPH_DB;
  const D = OPH_DATA;

  const App = {
    settings: null,
    options: null,
    sessions: [],
    session: null,      // active session object
    patients: [],       // patients of active session, in session.order
    patient: null,      // selected patient
    view: 'home',       // home | patients | list | transcribe | export | settings | sessions
    tab: 'details',
    saveTimer: null,
    wakeLock: null,
    listeners: []
  };

  /* ---------- helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function toast(msg) {
    let t = $('#toast'); if (!t) { t = el('div', { id: 'toast' }); document.body.appendChild(t); }
    t.innerHTML = ''; const d = el('div', { class: 't', text: msg }); t.appendChild(d);
    clearTimeout(t._h); t._h = setTimeout(() => { d.remove(); }, 2600);
  }
  function confirmModal(title, body, onYes, yesLabel) {
    const bg = el('div', { class: 'modal-bg' });
    const m = el('div', { class: 'modal' }, [
      el('h3', { text: title }),
      el('div', { text: body || '' }),
      el('div', { class: 'actions' }, [
        el('button', { class: 'btn danger', text: yesLabel || 'تأكيد', onclick: () => { bg.remove(); onYes(); } }),
        el('button', { class: 'btn ghost', text: 'إلغاء', onclick: () => bg.remove() })
      ])
    ]);
    bg.appendChild(m); bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
    document.body.appendChild(bg);
  }

  function getOptions(key) {
    return (App.options && App.options[key]) || D.DEFAULT_OPTIONS[key] || [];
  }

  /* ---------- persistence ---------- */
  const dirty = new Map();
  function savePatient(p, rerender) {
    p.updatedAt = Date.now();
    dirty.set(p.id, p);
    DB.put('patients', p).then(() => { if (dirty.get(p.id) === p && dirty.get(p.id).updatedAt === p.updatedAt) dirty.delete(p.id); })
      .catch(e => console.error('save failed', e));
  }
  window.addEventListener('pagehide', () => { dirty.forEach(p => { try { DB.put('patients', p); } catch (e) {} }); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) dirty.forEach(p => { try { DB.put('patients', p); } catch (e) {} }); });
  function saveSession() {
    if (!App.session) return;
    App.session.updatedAt = Date.now();
    DB.put('sessions', App.session);
  }
  function saveSettings() { DB.kvSet('settings', App.settings); DB.kvSet('options', App.options); }

  /* ---------- boot ---------- */
  async function boot() {
    await DB.open();
    // Ask the browser not to evict this origin's data (Persistent Storage).
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(g => console.log('persistent storage:', g)).catch(() => {});
    App.settings = (await DB.kvGet('settings', null)) || Object.assign({}, D.DEFAULT_SETTINGS);
    App.options = (await DB.kvGet('options', null)) || JSON.parse(JSON.stringify(D.DEFAULT_OPTIONS));
    App.sessions = await DB.all('sessions');
    App.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    const lastSid = await DB.kvGet('lastSessionId', null);
    if (lastSid && App.sessions.find(s => s.id === lastSid)) await openSession(lastSid, true);
    applyTheme();
    if (window.OPH_LOCK) OPH_LOCK.init();
    render();
  }

  function applyTheme() {
    document.body.dataset.theme = App.settings.darkMode ? 'dark' : '';
    document.body.style.fontSize = (16 * (App.settings.fontScale || 1)) + 'px';
  }

  async function openSession(id, silent) {
    App.session = App.sessions.find(s => s.id === id) || await DB.get('sessions', id);
    if (!App.session) return;
    const ps = await DB.patientsOf(id);
    const byId = {}; ps.forEach(p => byId[p.id] = p);
    App.session.order = (App.session.order || []).filter(pid => byId[pid]);
    ps.forEach(p => { if (!App.session.order.includes(p.id)) App.session.order.push(p.id); });
    App.patients = App.session.order.map(pid => byId[pid]);
    App.patient = App.patients[0] || null;
    DB.kvSet('lastSessionId', id);
    if (!silent) App.view = 'patients';
  }

  async function createSession(prepDate, surgeryDate, title) {
    const s = newSession(prepDate, surgeryDate, title);
    await DB.put('sessions', s);
    App.sessions.unshift(s);
    await openSession(s.id, true);
    App.view = 'patients';
    render();
  }

  async function deleteSession(id) {
    const ps = await DB.patientsOf(id);
    for (const p of ps) await DB.del('patients', p.id);
    await DB.del('sessions', id);
    App.sessions = App.sessions.filter(s => s.id !== id);
    if (App.session && App.session.id === id) { App.session = null; App.patients = []; App.patient = null; }
  }

  async function addPatient() {
    if (!App.session) { toast('أنشئ جلسة تحضير أولًا'); return null; }
    const p = newPatient(App.session.id, App.session.order.length + 1);
    // duplicate record number warning happens on edit; save now as draft
    await DB.put('patients', p);
    App.session.order.push(p.id); saveSession();
    App.patients.push(p);
    App.patient = p;
    App.view = 'patients'; App.tab = 'details';
    render();
    return p;
  }

  async function deletePatient(p) {
    await DB.del('patients', p.id);
    App.session.order = App.session.order.filter(x => x !== p.id); saveSession();
    App.patients = App.patients.filter(x => x.id !== p.id);
    if (App.patient && App.patient.id === p.id) App.patient = App.patients[0] || null;
    renumber();
  }

  function renumber() {
    App.patients.forEach((p, i) => { p.caseNo = i + 1; savePatient(p); });
  }

  function selectPatient(id) {
    App.patient = App.patients.find(p => p.id === id) || null;
    render();
  }

  /* ---------- render root ---------- */
  function render() {
    const root = $('#app');
    root.innerHTML = '';
    if (App.view === 'home') return OPH_HOME.render(root);
    if (App.view === 'sessions') return OPH_HOME.renderSessions(root);
    if (App.view === 'patients') return OPH_PATIENT.render(root);
    if (App.view === 'list') return OPH_SLIST.render(root);
    if (App.view === 'transcribe') return OPH_TRANS.render(root);
    if (App.view === 'export') return OPH_EXPORT.render(root);
    if (App.view === 'settings') return OPH_SETTINGS.render(root);
  }

  function go(view) { App.view = view; render(); }

  window.OPH = App;
  window.OPH_UTIL = { $, $$, el, esc, toast, confirmModal, getOptions, savePatient, saveSession, saveSettings, openSession, createSession, deleteSession, addPatient, deletePatient, renumber, selectPatient, render, go, applyTheme };

  document.addEventListener('DOMContentLoaded', boot);
})();
