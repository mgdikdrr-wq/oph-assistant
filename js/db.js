/* IndexedDB storage layer — offline first, autosave, no external services. */
(function () {
  const DB_NAME = 'oph-assistant';
  const DB_VER = 1;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('sessions')) d.createObjectStore('sessions', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('patients')) {
          const p = d.createObjectStore('patients', { keyPath: 'id' });
          p.createIndex('sessionId', 'sessionId', { unique: false });
        }
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'k' });
      };
      req.onsuccess = async () => { db = req.result; try { await initKey(); } catch (e) { console.error('crypto init failed', e); } resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx(store, mode) { return db.transaction(store, mode).objectStore(store); }
  function wrap(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

  /* At-rest encryption: patient and session records are AES-GCM sealed before
     they touch IndexedDB. Only id/sessionId/updatedAt stay readable (indexing
     needs them); every clinical field lives inside the ciphertext. */
  let encKey = null;
  async function initKey() {
    const r = await wrap(tx('kv', 'readonly').get('deviceKey'));
    if (r && r.v) { encKey = r.v; return; }
    encKey = await OPH_CRYPTO.genKey();
    await wrap(tx('kv', 'readwrite').put({ k: 'deviceKey', v: encKey }));
  }
  const ENCRYPTED = { patients: true, sessions: true };
  async function seal(store, obj) {
    const payload = await OPH_CRYPTO.encryptJSON(encKey, obj);
    const row = { id: obj.id, updatedAt: obj.updatedAt || Date.now(), enc: 1, iv: payload.iv, ct: payload.ct };
    if (store === 'patients') row.sessionId = obj.sessionId;
    return row;
  }
  async function unseal(row) {
    if (!row || !row.enc) return row;
    if (!encKey) return null;
    try { return await OPH_CRYPTO.decryptJSON(encKey, row); } catch (e) { console.error('decrypt failed', e); return null; }
  }
  async function putRow(store, obj) {
    const rec = (ENCRYPTED[store] && encKey) ? await seal(store, obj) : obj;
    return wrap(tx(store, 'readwrite').put(rec));
  }
  async function getRow(store, key) { return unseal(await wrap(tx(store, 'readonly').get(key))); }
  async function allRows(store) {
    const rows = await wrap(tx(store, 'readonly').getAll());
    const out = [];
    for (const r of rows) { const d = await unseal(r); if (d) out.push(d); }
    return out;
  }

  const DB = {
    open,
    put: (store, obj) => putRow(store, obj),
    del: (store, key) => wrap(tx(store, 'readwrite').delete(key)),
    get: (store, key) => getRow(store, key),
    all: (store) => allRows(store),
    patientsOf: async (sid) => {
      const rows = await new Promise((res, rej) => {
        const out = [];
        const c = tx('patients', 'readonly').index('sessionId').openCursor(IDBKeyRange.only(sid));
        c.onsuccess = (e) => { const cur = e.target.result; if (cur) { out.push(cur.value); cur.continue(); } else res(out); };
        c.onerror = () => rej(c.error);
      });
      const out = [];
      for (const r of rows) { const d = await unseal(r); if (d) out.push(d); }
      return out;
    },
    kvGet: async (k, fallback) => { const r = await wrap(tx('kv', 'readonly').get(k)); return r ? r.v : fallback; },
    kvSet: (k, v) => wrap(tx('kv', 'readwrite').put({ k, v }))
  };

  /* ---------- model factories ---------- */
  function uid() { return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9); }
  function todayStr() { const d = new Date(); return d.toISOString().slice(0, 10); }
  function nowTime() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function emptyEyeFindings() {
    const o = {};
    ['generalFeatures','lidConj','cornea','antChamber','pupilIris','lens','plp','fundus','orbitEom'].forEach(k => {
      o[k] = { findings: [], notes: '' }; // lens findings: {label, grade}
    });
    return o;
  }

  function newPatient(sessionId, caseNo) {
    return {
      id: uid(), sessionId, caseNo,
      name: '', recordNo: '', age: '', gender: '', // 'M' | 'F'
      date: todayStr(), time: nowTime(), visitType: '', // 'first' | 'followup'
      complaint: { items: [], eye: '', duration: '', onset: '', progression: '', notes: '' },
      pastHistory: [],       // [{item, eye, date, details}]
      systemic: [],          // strings; 'Free' exclusive
      exam: { od: emptyEyeFindings(), os: emptyEyeFindings() },
      vision: { od: { unaided:'', aided:'', pinhole:'', cfDist:'' }, os: { unaided:'', aided:'', pinhole:'', cfDist:'' } },
      iop: { od: { value:'', method:'', notMeasured:false }, os: { value:'', method:'', notMeasured:false } },
      refraction: { od: [], os: [] }, // [{sph,cyl,axis,type}]
      diagnoses: { od: [], os: [], ou: [], suggested: '' },
      investigations: { current: [], requested: [], results: [], notes: '' },
      biometry: { od: { al:'', k1:'', k2:'', acd:'', iolPower:'', targetRef:'', iolModel:'', notes:'' },
                  os: { al:'', k1:'', k2:'', acd:'', iolPower:'', targetRef:'', iolModel:'', notes:'' } },
      treatment: { current: [], recommended: [] }, // [{drug, eye, freq, duration, notes}]
      surgery: { operation: '', eye: '', iolPower: '', diagnosisText: '', vaText: '', notes: '', hcv: '', hbv: '' },
      inList: false,
      reviewApproved: false,
      needsReview: false,
      statusOverride: '',
      sheetTranscribed: false,
      listTranscribed: false,
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  function newSession(prepDate, surgeryDate, title) {
    return { id: uid(), title: title || '', prepDate: prepDate || todayStr(), surgeryDate: surgeryDate || '', order: [], createdAt: Date.now(), updatedAt: Date.now() };
  }

  /* ---------- clinical status ---------- */
  // What the review screen checks (directive §18).
  function checklist(p) {
    const eye = p.surgery.eye;
    const op = p.surgery.operation;
    const opIsPhaco = op === 'Phaco';
    const iol = p.surgery.iolPower || (eye ? p.biometry[eye.toLowerCase()].iolPower : '');
    const items = [
      { key:'name',  ok: !!p.name.trim(),        ar:'اسم المريض' },
      { key:'eye',   ok: !!eye,                  ar:'العين المقررة للعملية' },
      { key:'op',    ok: !!op,                   ar:'العملية' },
      { key:'dx',    ok: !!(p.surgery.diagnosisText.trim() || p.diagnoses.ou.length || (eye && p.diagnoses[eye.toLowerCase()].length)), ar:'التشخيص' },
      { key:'va',    ok: !!(p.surgery.vaText.trim() || (eye && bestVA(p, eye))), ar:'حدة الإبصار للعين المقررة' },
      { key:'viral', ok: !!(p.surgery.hcv && p.surgery.hbv), ar:'نتائج الفيروسات HCV / HBV' }
    ];
    if (opIsPhaco) items.push({ key:'iol', ok: !!String(iol).trim(), ar:'قوة العدسة IOL Power' });
    return items;
  }

  function bestVA(p, eye) {
    const v = p.vision[eye.toLowerCase()];
    if (!v) return '';
    let t = v.aided || v.unaided || '';
    if (t === 'CF' && v.cfDist) t += ' ' + v.cfDist;
    return t;
  }

  function status(p) {
    if (p.reviewApproved && !p.needsReview) return 'completed';
    const cl = checklist(p);
    const missing = cl.filter(i => !i.ok).length;
    if (missing === 0) return 'ready';
    const hasAnything = p.name.trim() || p.recordNo || p.complaint.items.length || p.surgery.operation;
    return hasAnything ? 'incomplete' : 'draft';
  }

  window.OPH_DB = { DB, uid, todayStr, nowTime, newPatient, newSession, checklist, bestVA, status };
})();
