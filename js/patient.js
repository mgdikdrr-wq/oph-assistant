/* Patient split view: sidebar + tabs (details, history, exam, diagnosis, investigations, treatment, surgery). */
(function () {
  const { $, el, esc, toast, confirmModal, savePatient, saveSession, addPatient, deletePatient, renumber, selectPatient, go, render, getOptions } = OPH_UTIL;
  const { status, bestVA } = OPH_DB;
  const { pickBox, composeLens, composeFindings } = OPH_UI;
  const D = OPH_DATA;

  const TABS = [
    ['details', 'بيانات المريض'],
    ['history', 'التاريخ المرضي'],
    ['exam', 'الفحص'],
    ['diagnosis', 'التشخيص'],
    ['investigations', 'الفحوصات'],
    ['treatment', 'العلاج'],
    ['surgery', 'تحضير العملية']
  ];

  let searchQ = '';

  function renderView(root) {
    if (!OPH.session) { go('home'); return; }
    root.appendChild(OPH_HOME.topbar(OPH.session.title || ('جلسة ' + OPH.session.prepDate)));
    const split = el('div', { class: 'split' });
    split.appendChild(sidebar());
    const main = el('div', { class: 'main' });
    if (OPH.patient) {
      main.appendChild(tabbar());
      const body = el('div', { class: 'tabbody' });
      renderTab(body, OPH.patient);
      main.appendChild(body);
    } else {
      main.appendChild(el('div', { class: 'tabbody' }, [
        el('div', { class: 'card' }, [
          el('p', { text: 'لا يوجد مرضى في هذه الجلسة بعد.' }),
          el('button', { class: 'btn primary', text: 'إضافة أول مريض', onclick: () => addPatient() })
        ])
      ]));
    }
    split.appendChild(main);
    root.appendChild(split);
    const t = OPH_HOME.topbar; // keep ref
  }

  /* ---------- sidebar ---------- */
  function sidebar() {
    const sb = el('div', { class: 'sidebar' });
    const search = el('input', { type: 'search', placeholder: 'بحث بالاسم أو رقم الملف…', value: searchQ, style: 'flex:1;border:1px solid var(--line);border-radius:10px;padding:10px;min-height:44px' });
    search.addEventListener('input', () => { searchQ = search.value; drawRows(); });
    sb.appendChild(el('div', { class: 'searchrow' }, [
      search,
      el('button', { class: 'btn primary small', text: '+ مريض', onclick: () => addPatient() })
    ]));
    const list = el('div', { class: 'plist' });
    sb.appendChild(list);

    function drawRows() {
      list.innerHTML = '';
      const q = searchQ.trim();
      OPH.patients.forEach((p, i) => {
        if (q && !(p.name.includes(q) || String(p.recordNo).includes(q))) return;
        const st = status(p);
        const row = el('div', { class: 'prow' + (OPH.patient && OPH.patient.id === p.id ? ' sel' : '') });
        row.appendChild(el('span', { class: 'num', text: String(i + 1) }));
        const meta = el('div', { class: 'meta' }, [
          el('div', { class: 'nm', text: p.name || '(بدون اسم)' }),
          el('div', { class: 'dt en', text: [p.age ? p.age + 'y' : '', p.surgery.operation || '', p.surgery.eye || ''].filter(Boolean).join(' · ') }),
          el('div', { class: 'badges' }, [
            el('span', { class: 'badge ' + (st === 'completed' ? 'ok' : st === 'ready' ? 'done' : 'warn'), text: D.STATUS[st].ar }),
            p.inList ? el('span', { class: 'badge done', text: 'في الليستة' }) : null,
            p.sheetTranscribed ? el('span', { class: 'badge ok', text: 'نُقل ✓' }) : null,
            p.needsReview ? el('span', { class: 'badge warn', text: 'يحتاج إعادة مراجعة' }) : null
          ])
        ]);
        row.appendChild(meta);
        row.addEventListener('click', () => selectPatient(p.id));
        // reorder + delete
        const ctr = el('div', { style: 'display:flex;flex-direction:column;gap:2px' });
        ctr.appendChild(el('button', { class: 'iconbtn', style: 'min-height:30px;padding:2px 8px', text: '▲', onclick: (e) => { e.stopPropagation(); move(i, -1); } }));
        ctr.appendChild(el('button', { class: 'iconbtn', style: 'min-height:30px;padding:2px 8px', text: '▼', onclick: (e) => { e.stopPropagation(); move(i, 1); } }));
        row.appendChild(ctr);
        row.appendChild(el('button', {
          class: 'iconbtn', style: 'min-height:30px;padding:2px 8px;color:var(--danger)', text: '🗑',
          onclick: (e) => { e.stopPropagation(); confirmModal('حذف الحالة', 'حذف "' + (p.name || 'بدون اسم') + '" وشيته نهائيًا؟', async () => { await deletePatient(p); render(); }, 'حذف'); }
        }));
        list.appendChild(row);
      });
    }
    function move(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= OPH.patients.length) return;
      const arr = OPH.patients; [arr[i], arr[j]] = [arr[j], arr[i]];
      OPH.session.order = arr.map(p => p.id); saveSession();
      renumber(); drawRows();
      if (window.OPH_SLIST) OPH_SLIST.refreshIfOpen && OPH_SLIST.refreshIfOpen();
    }
    drawRows();
    sb._redraw = drawRows;
    return sb;
  }

  /* ---------- tab bar ---------- */
  function tabbar() {
    const bar = el('div', { class: 'tabs' });
    // prev/next quick navigation
    bar.appendChild(el('button', { class: 'tab', text: '⟶ السابق', onclick: () => step(-1) }));
    TABS.forEach(([k, label]) => {
      bar.appendChild(el('button', { class: 'tab' + (OPH.tab === k ? ' on' : ''), text: label, onclick: () => { OPH.tab = k; render(); } }));
    });
    bar.appendChild(el('button', { class: 'tab', text: 'التالي ⟵', onclick: () => step(1) }));
    return bar;
  }
  function step(dir) {
    const i = OPH.patients.findIndex(p => OPH.patient && p.id === OPH.patient.id);
    const j = i + dir;
    if (j >= 0 && j < OPH.patients.length) selectPatient(OPH.patients[j].id);
  }

  function renderTab(body, p) {
    if (OPH.tab === 'details') tabDetails(body, p);
    else if (OPH.tab === 'history') tabHistory(body, p);
    else if (OPH.tab === 'exam') OPH_EXAM.render(body, p);
    else if (OPH.tab === 'diagnosis') tabDiagnosis(body, p);
    else if (OPH.tab === 'investigations') tabInvestigations(body, p);
    else if (OPH.tab === 'treatment') tabTreatment(body, p);
    else if (OPH.tab === 'surgery') OPH_SURGERY.render(body, p);
  }

  /* ---------- details tab ---------- */
  function tabDetails(body, p) {
    const card = el('div', { class: 'card' }, [el('h3', { text: 'البيانات الأساسية' })]);

    const name = input(p.name, v => { p.name = v; savePatient(p); }, 'الاسم الرباعي');
    const rec = input(p.recordNo, v => { p.recordNo = v; savePatient(p); checkDupRec(p); }, 'رقم الملف', 'text');
    rec.inputMode = 'numeric'; rec.dir = 'ltr';
    const age = input(p.age, v => { p.age = v; savePatient(p); }, 'السن', 'number');
    age.inputMode = 'numeric';
    const date = input(p.date, v => { p.date = v; savePatient(p); }, '', 'date');
    const time = input(p.time, v => { p.time = v; savePatient(p); }, '', 'time');

    card.appendChild(row([field('الاسم الرباعي', name), field('رقم الملف Record No.', rec), field('السن', age)]));
    card.appendChild(row([field('التاريخ Date', date), field('الوقت Time', time)]));

    const gWrap = el('div', { class: 'chips' });
    [['M', 'Male — ذكر'], ['F', 'Female — أنثى']].forEach(([v, l]) => {
      gWrap.appendChild(el('button', { class: 'chip' + (p.gender === v ? ' on' : ''), text: l, onclick: () => { p.gender = v; savePatient(p); render(); } }));
    });
    card.appendChild(row([field('النوع Gender', gWrap)]));

    const vWrap = el('div', { class: 'chips' });
    [['first', 'First visit — أول زيارة'], ['followup', 'Follow-up — متابعة']].forEach(([v, l]) => {
      vWrap.appendChild(el('button', { class: 'chip' + (p.visitType === v ? ' on' : ''), text: l, onclick: () => { p.visitType = v; savePatient(p); render(); } }));
    });
    card.appendChild(row([field('نوع الزيارة', vWrap)]));
    body.appendChild(card);

    function checkDupRec(p) {
      if (!p.recordNo) return;
      const dup = OPH.patients.find(x => x.id !== p.id && x.recordNo && x.recordNo === p.recordNo);
      if (dup) toast('تنبيه: رقم الملف ' + p.recordNo + ' مسجل أيضًا للحالة رقم ' + dup.caseNo + ' (' + (dup.name || 'بدون اسم') + ')');
    }
  }

  /* ---------- history tab ---------- */
  function tabHistory(body, p) {
    // Complaint
    const cCard = el('div', { class: 'card' }, [el('h3', { text: 'الشكوى Complaint' })]);
    cCard.appendChild(pickBox({
      listKey: 'complaint', selected: p.complaint.items, onChange: sel => { p.complaint.items = sel; savePatient(p); }
    }));
    const eyeChips = el('div', { class: 'chips' });
    D.COMPLAINT_EYES.forEach(e => eyeChips.appendChild(el('button', { class: 'chip en' + (p.complaint.eye === e ? ' on' : ''), text: e, onclick: () => { p.complaint.eye = p.complaint.eye === e ? '' : e; savePatient(p); render(); } })));
    const dur = input(p.complaint.duration, v => { p.complaint.duration = v; savePatient(p); }, 'مثل: 6 months');
    const onsetChips = el('div', { class: 'chips' });
    D.ONSET.forEach(o => onsetChips.appendChild(el('button', { class: 'chip en' + (p.complaint.onset === o ? ' on' : ''), text: o, onclick: () => { p.complaint.onset = p.complaint.onset === o ? '' : o; savePatient(p); render(); } })));
    const progChips = el('div', { class: 'chips' });
    D.PROGRESSION.forEach(o => progChips.appendChild(el('button', { class: 'chip en' + (p.complaint.progression === o ? ' on' : ''), text: o, onclick: () => { p.complaint.progression = p.complaint.progression === o ? '' : o; savePatient(p); render(); } })));
    cCard.appendChild(row([field('العين', eyeChips), field('المدة Duration', dur)]));
    cCard.appendChild(row([field('البداية Onset', onsetChips), field('المسار Progression', progChips)]));
    const notes = el('textarea', { rows: 2, style: 'width:100%' }); notes.value = p.complaint.notes;
    notes.addEventListener('input', () => { p.complaint.notes = notes.value; savePatient(p); });
    cCard.appendChild(field('كتابة حرة', notes));
    body.appendChild(cCard);

    // Past history
    const phCard = el('div', { class: 'card' }, [el('h3', { text: 'التاريخ المرضي السابق Past History' })]);
    p.pastHistory.forEach((h, i) => {
      phCard.appendChild(el('div', { class: 'frow' }, [
        el('span', { class: 'en', style: 'flex:1;font-weight:600', text: h.item + (h.eye ? ' — ' + h.eye : '') + (h.date ? ' — ' + h.date : '') + (h.details ? ' — ' + h.details : '') }),
        el('button', { class: 'btn small danger', text: 'حذف', onclick: () => { p.pastHistory.splice(i, 1); savePatient(p); render(); } })
      ]));
    });
    const selItem = el('select'); getOptions('pastHistory').forEach(o => selItem.appendChild(el('option', { text: o, value: o })));
    const selEye = el('select'); ['', 'OD', 'OS', 'OU'].forEach(o => selEye.appendChild(el('option', { text: o || 'العين؟', value: o })));
    const inDate = el('input', { type: 'month' });
    const inDet = el('input', { type: 'text', placeholder: 'تفاصيل' });
    phCard.appendChild(el('div', { class: 'frow' }, [selItem, selEye, inDate, inDet,
      el('button', { class: 'btn small primary', text: '+ إضافة', onclick: () => { p.pastHistory.push({ item: selItem.value, eye: selEye.value, date: inDate.value, details: inDet.value.trim() }); savePatient(p); render(); } })
    ]));
    body.appendChild(phCard);

    // Systemic diseases
    const sCard = el('div', { class: 'card' }, [el('h3', { text: 'الأمراض العامة Systemic Diseases' })]);
    const chips = el('div', { class: 'chips' });
    const freeBtn = el('button', {
      class: 'chip en' + (p.systemic.includes('Free') ? ' on' : ''), text: 'Free — سليم', onclick: () => {
        p.systemic = p.systemic.includes('Free') ? [] : ['Free']; savePatient(p); render();
      }
    });
    chips.appendChild(freeBtn);
    getOptions('systemic').forEach(o => {
      chips.appendChild(el('button', {
        class: 'chip en' + (p.systemic.includes(o) ? ' on' : ''), text: o, onclick: () => {
          if (p.systemic.includes(o)) p.systemic = p.systemic.filter(x => x !== o);
          else { p.systemic = p.systemic.filter(x => x !== 'Free'); p.systemic.push(o); }
          savePatient(p); render();
        }
      }));
    });
    sCard.appendChild(chips);
    body.appendChild(sCard);
  }

  /* ---------- diagnosis tab ---------- */
  function tabDiagnosis(body, p) {
    const eyes = [['od', 'العين اليمنى OD'], ['os', 'العين اليسرى OS'], ['ou', 'العينان OU']];
    eyes.forEach(([k, label]) => {
      const card = el('div', { class: 'card' }, [el('h3', { text: 'تشخيص ' + label })]);
      p.diagnoses[k].forEach((d, i) => {
        card.appendChild(el('div', { class: 'frow' }, [
          el('span', { class: 'en', style: 'flex:1;font-weight:600', text: d }),
          el('button', { class: 'btn small danger', text: 'حذف', onclick: () => { p.diagnoses[k].splice(i, 1); savePatient(p); render(); } })
        ]));
      });
      const inp = el('input', { class: 'en', type: 'text', placeholder: 'اكتب أو اختر تشخيصًا…', list: 'dx-' + k });
      const dl = el('datalist', { id: 'dx-' + k });
      getOptions('diagnosis').forEach(o => dl.appendChild(el('option', { value: o })));
      card.appendChild(el('div', { class: 'frow' }, [inp, dl, el('button', {
        class: 'btn small primary', text: '+ إضافة', onclick: () => {
          const v = inp.value.trim(); if (!v) return;
          p.diagnoses[k].push(v); savePatient(p); render();
        }
      })]));
      body.appendChild(card);
    });

    // suggested diagnosis text (doctor reviews/edits)
    const sCard = el('div', { class: 'card' }, [el('h3', { text: 'نص التشخيص المختصر (قابل للتعديل والاعتماد)' })]);
    const sugg = el('textarea', { rows: 2, style: 'width:100%', class: 'en' }); sugg.value = p.diagnoses.suggested || '';
    sugg.addEventListener('input', () => { p.diagnoses.suggested = sugg.value; savePatient(p); });
    sCard.appendChild(sugg);
    sCard.appendChild(el('button', {
      class: 'btn small ghost', text: 'اقتراح من نتائج الفحص (مراجعة يدوية)', onclick: () => {
        const parts = [];
        ['od', 'os'].forEach(e => {
          const lens = composeLens(p.exam[e].lens.findings);
          if (lens) parts.push(e.toUpperCase() + ': ' + lens);
        });
        sugg.value = parts.join(' | '); p.diagnoses.suggested = sugg.value; savePatient(p);
        toast('راجع النص وعدّله قبل الاعتماد');
      }
    }));
    body.appendChild(sCard);
  }

  /* ---------- investigations tab ---------- */
  function tabInvestigations(body, p) {
    [['current', 'الفحوصات الحالية Current'], ['requested', 'الفحوصات المطلوبة Requested'], ['results', 'النتائج Results']].forEach(([k, label]) => {
      const card = el('div', { class: 'card' }, [el('h3', { text: label })]);
      p.investigations[k].forEach((r, i) => {
        card.appendChild(el('div', { class: 'frow' }, [
          el('span', { class: 'en', style: 'flex:1;font-weight:600', text: r.item + (r.result ? ' — ' + r.result : '') }),
          el('button', { class: 'btn small danger', text: 'حذف', onclick: () => { p.investigations[k].splice(i, 1); savePatient(p); render(); } })
        ]));
      });
      const sel = el('select'); getOptions('investigations').forEach(o => sel.appendChild(el('option', { text: o, value: o })));
      const res = el('input', { class: 'en', type: 'text', placeholder: k === 'results' ? 'النتيجة' : 'ملاحظة (اختياري)' });
      card.appendChild(el('div', { class: 'frow' }, [sel, res, el('button', {
        class: 'btn small primary', text: '+ إضافة', onclick: () => {
          p.investigations[k].push({ item: sel.value, result: res.value.trim() }); savePatient(p); render();
        }
      })]));
      body.appendChild(card);
    });
    const nCard = el('div', { class: 'card' }, [el('h3', { text: 'ملاحظات الفحوصات' })]);
    const n = el('textarea', { rows: 2, style: 'width:100%' }); n.value = p.investigations.notes;
    n.addEventListener('input', () => { p.investigations.notes = n.value; savePatient(p); });
    nCard.appendChild(n);
    body.appendChild(nCard);

    // Biometry & IOL
    const bCard = el('div', { class: 'card' }, [el('h3', { text: 'Biometry & IOL — تحضير الفاكو (اختياري)' })]);
    const grid = el('div', { class: 'eyegrid' });
    [['od', 'Right Eye — OD'], ['os', 'Left Eye — OS']].forEach(([e, label]) => {
      const b = p.biometry[e];
      const col = el('div', { class: 'eyecol' }, [el('h4', { class: 'en', text: label })]);
      const mk = (lab, key, ph) => {
        const i = input(b[key], v => { b[key] = v; savePatient(p); }, ph || '', 'text');
        i.inputMode = 'decimal'; i.dir = 'ltr';
        return field(lab, i);
      };
      col.appendChild(row([mk('AL', 'al'), mk('K1', 'k1'), mk('K2', 'k2')]));
      col.appendChild(row([mk('ACD', 'acd'), mk('IOL Power', 'iolPower', '+21.5'), mk('Target Ref.', 'targetRef')]));
      col.appendChild(row([mk('IOL Model', 'iolModel')]));
      const nt = el('textarea', { rows: 1, style: 'width:100%' }); nt.value = b.notes;
      nt.addEventListener('input', () => { b.notes = nt.value; savePatient(p); });
      col.appendChild(field('ملاحظات', nt));
      grid.appendChild(col);
    });
    bCard.appendChild(grid);
    body.appendChild(bCard);
  }

  /* ---------- treatment tab ---------- */
  function tabTreatment(body, p) {
    [['current', 'العلاج الحالي Current'], ['recommended', 'العلاج المقترح Recommended']].forEach(([k, label]) => {
      const card = el('div', { class: 'card' }, [el('h3', { text: label })]);
      p.treatment[k].forEach((t, i) => {
        card.appendChild(el('div', { class: 'frow' }, [
          el('span', { class: 'en', style: 'flex:1;font-weight:600', text: [t.drug, t.eye, t.freq, t.duration, t.notes].filter(Boolean).join(' — ') }),
          el('button', { class: 'btn small danger', text: 'حذف', onclick: () => { p.treatment[k].splice(i, 1); savePatient(p); render(); } })
        ]));
      });
      const drug = el('input', { class: 'en', type: 'text', placeholder: 'اسم الدواء', list: 'favdrugs' });
      const dl = el('datalist', { id: 'favdrugs' });
      (OPH.settings.favoriteDrugs || []).forEach(dn => dl.appendChild(el('option', { value: dn })));
      const eye = el('select'); ['', 'OD', 'OS', 'OU'].forEach(o => eye.appendChild(el('option', { text: o || 'العين', value: o })));
      const freq = el('input', { class: 'en', type: 'text', placeholder: 'التكرار مثل TID' });
      const dur = el('input', { class: 'en', type: 'text', placeholder: 'المدة' });
      card.appendChild(el('div', { class: 'frow' }, [drug, dl, eye, freq, dur, el('button', {
        class: 'btn small primary', text: '+ إضافة', onclick: () => {
          const v = drug.value.trim(); if (!v) return;
          p.treatment[k].push({ drug: v, eye: eye.value, freq: freq.value.trim(), duration: dur.value.trim(), notes: '' });
          if (!(OPH.settings.favoriteDrugs || []).includes(v)) { OPH.settings.favoriteDrugs = (OPH.settings.favoriteDrugs || []).concat([v]); OPH_UTIL.saveSettings(); }
          savePatient(p); render();
        }
      })]));
      body.appendChild(card);
    });
  }

  /* ---------- small builders ---------- */
  function row(children) { return el('div', { class: 'frow' }, children); }
  function field(label, node) { return el('div', { class: 'field' }, [el('label', { text: label }), node]); }
  function input(val, onChange, ph, type) {
    const i = el('input', { type: type || 'text', placeholder: ph || '' });
    i.value = val == null ? '' : val;
    i.addEventListener('input', () => onChange(i.value));
    return i;
  }

  window.OPH_PATIENT = { render: renderView };
  // expose small builders for other modules
  window.OPH_BUILD = { row, field, input };
})();
