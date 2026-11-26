/* Surgical List view: official column order, reorder, per-op counts, list-transcribed state. */
(function () {
  const { el, toast, savePatient, saveSession, render, go } = OPH_UTIL;
  const { status, bestVA } = OPH_DB;

  function listPatients() {
    return OPH.patients.filter(p => p.inList);
  }

  // Row data pulled live from the sheet (operative eye only).
  function rowData(p) {
    const s = p.surgery;
    const medically = p.systemic.includes('Free') ? 'Free' : p.systemic.join(' / ');
    const va = s.vaText || (s.eye ? bestVA(p, s.eye) : '');
    const dx = s.diagnosisText || (s.eye ? (p.diagnoses[s.eye.toLowerCase()][0] || p.diagnoses.ou[0] || '') : '') || p.diagnoses.suggested || '';
    const iol = s.operation === 'Phaco' ? (s.iolPower || (s.eye ? p.biometry[s.eye.toLowerCase()].iolPower : '')) : '';
    let viral = '';
    if (s.hcv || s.hbv) viral = 'HCV: ' + (s.hcv || '—') + '  HBV: ' + (s.hbv || '—');
    return {
      no: 0, name: p.name, recordNo: p.recordNo, age: p.age, medically,
      va, dx, op: (s.eye ? s.eye + ' ' : '') + (s.operation || ''), viral, iol,
      eye: s.eye
    };
  }

  let cleanView = false;

  function renderList(root) {
    if (!OPH.session) { go('home'); return; }
    root.appendChild(OPH_HOME.topbar('ليستة العمليات الكبرى' + (OPH.session.surgeryDate ? ' — يوم ' + OPH.session.surgeryDate : '')));

    // per-operation counts
    const counts = {};
    listPatients().forEach(p => { counts[p.surgery.operation] = (counts[p.surgery.operation] || 0) + 1; });

    const bar = el('div', { class: 'listbar' }, [
      el('button', { class: 'iconbtn', text: '→ الرئيسية', onclick: () => go('home') }),
      el('button', { class: 'btn small' + (cleanView ? '' : ' primary'), text: 'وضع التعديل', onclick: () => { cleanView = false; render(); } }),
      el('button', { class: 'btn small' + (cleanView ? ' primary' : ''), text: 'عرض نظيف', onclick: () => { cleanView = true; render(); } }),
      el('button', { class: 'btn accent small', text: 'نُقلت الليستة للورق ✓', onclick: () => {
        const incomplete = listPatients().filter(p => status(p) !== 'completed');
        const mark = () => { listPatients().forEach(p => { p.listTranscribed = true; savePatient(p); }); render(); toast('سُجلت كل الحالات كمنقولة للورق'); };
        if (incomplete.length) {
          OPH_UTIL.confirmModal('حالات غير مكتملة', 'يوجد ' + incomplete.length + ' حالة غير مكتملة التحضير في الليستة — تسجيل الليستة كمنقولة الآن يعني نقل حالات ناقصة. متابعة؟', mark, 'متابعة');
          return;
        }
        mark();
      } }),
      el('span', { class: 'spacer', style: 'flex:1' }),
      el('span', { text: 'الإجمالي: ' + listPatients().length })
    ]);
    Object.keys(counts).forEach(op => {
      bar.appendChild(el('span', { class: 'badge done en', text: op + ': ' + counts[op] }));
    });
    const search = el('input', { type: 'search', placeholder: 'بحث…', style: 'border:1px solid var(--line);border-radius:10px;padding:8px;min-height:40px' });
    search.addEventListener('input', () => draw(search.value.trim()));
    bar.appendChild(search);
    root.appendChild(bar);

    const incompleteN = listPatients().filter(p => status(p) !== 'completed').length;
    if (incompleteN) {
      root.appendChild(el('div', { class: 'warnbar', text: 'تنبيه: ' + incompleteN + ' حالة غير مكتملة التحضير (مظللة بالأصفر) — لا تُعتبر الليستة نهائية قبل مراجعتها واعتمادها.' }));
    }

    const wrap = el('div', { class: 'listwrap' + (cleanView ? ' clean' : '') });
    root.appendChild(wrap);

    const COLS = ['', 'No', 'Patient Name', 'Record No', 'Age', 'Medically', 'V/A', 'Diagnosis', 'Operation', 'HCV / HBV', 'IOL Power', 'توقيع الطبيب الجراح', 'توقيع طبيب التخدير', ''];

    function draw(q) {
      wrap.innerHTML = '';
      const ps = listPatients();
      const table = el('table', { class: 'slist' });
      const trh = el('tr');
      COLS.forEach((c, ci) => {
        if (cleanView && (ci === 0 || ci === COLS.length - 1)) return; // hide edit/action columns
        trh.appendChild(el('th', { text: c }));
      });
      table.appendChild(trh);
      ps.forEach((p, i) => {
        if (q && !(p.name.includes(q) || String(p.recordNo).includes(q))) return;
        const d = rowData(p);
        const st = status(p);
        const tr = el('tr', { class: (st !== 'completed' ? 'incomplete ' : '') + (p.listTranscribed ? 'transcribed' : '') });
        // drag handle (move up/down for touch reliability) — editing mode only
        if (!cleanView) {
          const h = el('td');
          h.appendChild(el('button', { class: 'rowhandle', text: '▲', onclick: () => move(p, -1) }));
          h.appendChild(el('button', { class: 'rowhandle', text: '▼', onclick: () => move(p, 1) }));
          tr.appendChild(h);
        }
        tr.appendChild(el('td', { class: 'en', text: String(i + 1) }));
        tr.appendChild(el('td', { class: 'ar', text: d.name || '—' }));
        tr.appendChild(el('td', { class: 'en', text: String(d.recordNo || '—') }));
        tr.appendChild(el('td', { class: 'en', text: String(d.age || '—') }));
        tr.appendChild(el('td', { class: 'en', text: d.medically || '—' }));
        tr.appendChild(el('td', { class: 'en', text: d.va || '—' }));
        tr.appendChild(el('td', { class: 'en', text: d.dx || '—' }));
        tr.appendChild(el('td', { class: 'en', text: d.op || '—' }));
        tr.appendChild(el('td', { class: 'en', text: d.viral || '—' }));
        tr.appendChild(el('td', { class: 'en', text: d.iol || '—' }));
        tr.appendChild(el('td', { text: '' }));
        tr.appendChild(el('td', { text: '' }));
        if (!cleanView) {
          const act = el('td');
          act.appendChild(el('button', { class: 'btn small ghost', text: 'فتح الشيت', onclick: () => { OPH_UTIL.selectPatient(p.id); go('patients'); } }));
          act.appendChild(el('button', { class: 'btn small danger', text: 'إزالة', onclick: () => { p.inList = false; savePatient(p); render(); } }));
          tr.appendChild(act);
        }
        table.appendChild(tr);
      });
      wrap.appendChild(table);
      if (!ps.length) wrap.appendChild(el('p', { style: 'padding:20px;text-align:center', text: 'الليستة فارغة — أضف مرضى من شاشة تحضير العملية بضغطة واحدة.' }));
    }

    function move(p, dir) {
      const i = OPH.patients.findIndex(x => x.id === p.id);
      let j = i + dir;
      // move within full patient order; list keeps patient order
      while (j >= 0 && j < OPH.patients.length && !OPH.patients[j].inList) j += dir;
      if (j < 0 || j >= OPH.patients.length) return;
      const arr = OPH.patients; [arr[i], arr[j]] = [arr[j], arr[i]];
      OPH.session.order = arr.map(x => x.id); saveSession();
      OPH_UTIL.renumber();
      draw(search.value.trim());
    }

    draw('');
  }

  window.OPH_SLIST_CLEAN = () => cleanView;

  window.OPH_SLIST = { render: renderList, listPatients, rowData };
})();
