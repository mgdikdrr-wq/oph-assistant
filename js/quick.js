/* Quick Examination Mode — single-screen sequential prep on the SAME patient model.
   Every control here writes the same fields the full 7-tab sheet edits, so both
   views always stay in sync (one record, two interfaces). */
(function () {
  const { el, toast, savePatient, render, getOptions } = OPH_UTIL;
  const { pickBox, composeLens } = OPH_UI;
  const D = OPH_DATA;
  // Same approval/transcription revocation semantics as the full sheet.
  const editSave = (pp) => { if (window.OPH_SURGERY) OPH_SURGERY.markForReview(pp, 'تعديل من الفحص السريع'); savePatient(pp); };

  function qsec(num, title, fullTab, children) {
    const head = el('div', { class: 'qsec-head' }, [
      el('span', { class: 'qnum', text: String(num) }),
      el('h3', { text: title }),
      el('span', { style: 'flex:1' }),
      fullTab ? el('button', { class: 'btn small ghost', text: 'فتح في الشيت الكامل', onclick: () => { OPH.tab = fullTab; render(); } }) : null
    ]);
    const card = el('div', { class: 'card qsec', id: 'qsec-' + num }, [head]);
    children.forEach(c => c && card.appendChild(c));
    return card;
  }

  function num(val, onChange, ph, width) {
    const i = el('input', { type: 'text', inputmode: 'decimal', placeholder: ph || '', style: 'direction:ltr;' + (width ? 'width:' + width + ';' : '') });
    i.value = val || '';
    i.addEventListener('input', () => onChange(i.value));
    return i;
  }
  function txt(val, onChange, ph, cls) {
    const i = el('input', { type: 'text', placeholder: ph || '', class: cls || '' });
    i.value = val || '';
    i.addEventListener('input', () => onChange(i.value));
    return i;
  }
  function chipsRow(options, current, onPick, en) {
    const c = el('div', { class: 'chips' });
    options.forEach(o => {
      c.appendChild(el('button', { class: 'chip' + (en ? ' en' : '') + (current === o ? ' on' : ''), text: o, onclick: () => onPick(o) }));
    });
    return c;
  }
  function eyeCol(eye, children) {
    const col = el('div', { class: 'eyecol ' + eye }, [el('h4', { html: eye === 'od' ? 'العين اليمنى <span class="en">OD</span>' : 'العين اليسرى <span class="en">OS</span>' })]);
    children.forEach(c => c && col.appendChild(c));
    return col;
  }
  function vaSelect(v, k, p) {
    const sel = el('select', { class: 'va' });
    sel.appendChild(el('option', { value: '', text: '—' }));
    D.VA_OPTIONS.forEach(o => sel.appendChild(el('option', { value: o, text: o })));
    sel.value = v[k];
    sel.addEventListener('change', () => { v[k] = sel.value; editSave(p); });
    return sel;
  }

  function renderQuick(body, p) {
    const { row, field } = OPH_BUILD;

    // jump nav
    const nav = el('div', { class: 'qnav' });
    [['1', 'بيانات'], ['2', 'شكوى'], ['3', 'تاريخ'], ['4', 'جهازية'], ['5', 'عملية'], ['6', 'نظر'], ['7', 'IOP'], ['8', 'انكسار'], ['9', 'فحص'], ['10', 'عدسة'], ['11', 'قاع'], ['12', 'تشخيص'], ['13', 'Biometry'], ['14', 'IOL'], ['15', 'فيروسي']].forEach(([n, l]) => {
      nav.appendChild(el('button', { class: 'tab', text: n + ' ' + l, onclick: () => { const t = document.getElementById('qsec-' + n); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }));
    });
    body.appendChild(nav);

    /* 1 — identity */
    body.appendChild(qsec(1, 'بيانات المريض', 'details', [
      row([
        field('الاسم الرباعي', txt(p.name, v => { p.name = v; editSave(p); }, 'الاسم الرباعي')),
        field('رقم الملف Record No.', (() => { const i = num(p.recordNo, v => { p.recordNo = v; editSave(p); }, 'رقم الملف'); i.inputMode = 'numeric'; return i; })()),
        field('السن', (() => { const i = num(p.age, v => { p.age = v; editSave(p); }, 'السن'); i.inputMode = 'numeric'; return i; })())
      ]),
      row([field('النوع Gender', chipsRow(['Male — ذكر', 'Female — أنثى'], p.gender === 'M' ? 'Male — ذكر' : p.gender === 'F' ? 'Female — أنثى' : '', o => { p.gender = o.startsWith('Male') ? 'M' : 'F'; editSave(p); render(); }))])
    ]));

    /* 2 — complaint */
    body.appendChild(qsec(2, 'الشكوى Complaint', 'history', [
      pickBox({ listKey: 'complaint', selected: p.complaint.items, onChange: sel => { p.complaint.items = sel; editSave(p); } }),
      row([
        field('العين', chipsRow(D.COMPLAINT_EYES, p.complaint.eye, o => { p.complaint.eye = p.complaint.eye === o ? '' : o; editSave(p); render(); }, true)),
        field('المدة', txt(p.complaint.duration, v => { p.complaint.duration = v; editSave(p); }, 'مثل: 6 months', 'en'))
      ])
    ]));

    /* 3 — past ocular history */
    const phList = el('div', {});
    p.pastHistory.forEach((h, i) => {
      phList.appendChild(el('div', { class: 'frow' }, [
        el('span', { class: 'en', style: 'flex:1;font-weight:600', text: h.item + (h.eye ? ' — ' + h.eye : '') + (h.details ? ' — ' + h.details : '') }),
        el('button', { class: 'btn small danger', text: 'حذف', onclick: () => { p.pastHistory.splice(i, 1); editSave(p); render(); } })
      ]));
    });
    const phItem = el('select'); getOptions('pastHistory').forEach(o => phItem.appendChild(el('option', { text: o, value: o })));
    const phEye = el('select'); ['', 'OD', 'OS', 'OU'].forEach(o => phEye.appendChild(el('option', { text: o || 'العين؟', value: o })));
    body.appendChild(qsec(3, 'التاريخ المرضي للعين Past History', 'history', [
      phList,
      el('div', { class: 'frow' }, [phItem, phEye, el('button', { class: 'btn small primary', text: '+ إضافة', onclick: () => { p.pastHistory.push({ item: phItem.value, eye: phEye.value, date: '', details: '' }); editSave(p); render(); } })])
    ]));

    /* 4 — systemic */
    const sysChips = el('div', { class: 'chips' });
    sysChips.appendChild(el('button', { class: 'chip en' + (p.systemic.includes('Free') ? ' on' : ''), text: 'Free — سليم', onclick: () => { p.systemic = p.systemic.includes('Free') ? [] : ['Free']; editSave(p); render(); } }));
    getOptions('systemic').forEach(o => sysChips.appendChild(el('button', {
      class: 'chip en' + (p.systemic.includes(o) ? ' on' : ''), text: o, onclick: () => {
        if (p.systemic.includes(o)) p.systemic = p.systemic.filter(x => x !== o);
        else { p.systemic = p.systemic.filter(x => x !== 'Free'); p.systemic.push(o); }
        editSave(p); render();
      }
    })));
    body.appendChild(qsec(4, 'الأمراض العامة Systemic Diseases', 'history', [sysChips]));

    /* 5 — operation + operative eye */
    const s = p.surgery;
    body.appendChild(qsec(5, 'العملية والعين المقررة', 'surgery', [
      row([field('العملية', chipsRow(getOptions('operations'), s.operation, o => {
        if (s.operation !== o) OPH_SURGERY.markForReview(p, 'تغيرت العملية');
        s.operation = s.operation === o ? '' : o;
        if (s.operation !== 'Phaco') s.iolPower = '';
        savePatient(p); render();
      }, true))]),
      row([field('العين', chipsRow(['OD', 'OS'], s.eye, o => {
        if (s.eye && s.eye !== o) {
          OPH_SURGERY.markForReview(p, 'تغيرت العين المقررة');
          s.vaText = ''; s.diagnosisText = ''; s.iolPower = '';
          toast('تنبيه: تغيرت العين — مُسحت القيم المرتبطة بالعين السابقة.');
        }
        s.eye = s.eye === o ? '' : o;
        savePatient(p); render();
      }, true))])
    ]));

    /* 6 — V/A */
    body.appendChild(qsec(6, 'حدة الإبصار V/A', 'exam', [
      el('div', { class: 'eyegrid' }, ['od', 'os'].map(eye => {
        const v = p.vision[eye];
        return eyeCol(eye, [['unaided', 'Unaided'], ['aided', 'Aided'], ['pinhole', 'Pinhole']].map(([k, lab]) =>
          el('div', { class: 'vrow' }, [el('span', { class: 'lab en', text: lab }), vaSelect(v, k, p)])));
      }))
    ]));

    /* 7 — IOP */
    body.appendChild(qsec(7, 'ضغط العين IOP', 'exam', [
      el('div', { class: 'eyegrid' }, ['od', 'os'].map(eye => {
        const io = p.iop[eye];
        const meth = el('select', { class: 'va' });
        meth.appendChild(el('option', { value: '', text: 'الوسيلة؟' }));
        D.IOP_METHODS.forEach(m => meth.appendChild(el('option', { value: m, text: m })));
        meth.value = io.method;
        meth.addEventListener('change', () => { io.method = meth.value; editSave(p); });
        return eyeCol(eye, [el('div', { class: 'vrow' }, [
          el('span', { class: 'lab en', text: 'IOP' }),
          num(io.value, v => { io.value = v; io.notMeasured = false; editSave(p); }, 'mmHg', '100px'),
          meth
        ])]);
      }))
    ]));

    /* 8 — refraction (quick readings) */
    body.appendChild(qsec(8, 'الانكسار Refraction', 'exam', [
      el('div', { class: 'eyegrid' }, ['od', 'os'].map(eye => {
        const kids = [];
        p.refraction[eye].forEach((r) => {
          kids.push(el('div', { class: 'vrow en' }, [
            el('span', { text: (r.type || 'Auto') + ':' }),
            num(r.sph, v => { r.sph = v; editSave(p); }, 'SPH', '72px'),
            num(r.cyl, v => { r.cyl = v; editSave(p); }, 'CYL', '72px'),
            num(r.axis, v => { r.axis = v; editSave(p); }, 'AXIS', '72px')
          ]));
        });
        kids.push(el('button', { class: 'btn small primary', text: '+ قراءة', onclick: () => { p.refraction[eye].push({ sph: '', cyl: '', axis: '', type: 'Autorefraction' }); editSave(p); render(); } }));
        return eyeCol(eye, kids);
      }))
    ]));

    /* 9 — key anterior findings (cornea, AC, pupil) */
    body.appendChild(qsec(9, 'أهم نتائج الفحص (قرنية / حجرة أمامية / حدقة)', 'exam', [
      el('div', { class: 'eyegrid' }, ['od', 'os'].map(eye => eyeCol(eye, ['cornea', 'antChamber', 'pupilIris'].map(k => {
        const sec = D.EXAM_SECTIONS.find(x => x.key === k);
        return el('div', { class: 'qmini' }, [
          el('div', { class: 'qmini-t', text: sec.ar }),
          pickBox({ listKey: k, selected: p.exam[eye][k].findings, onChange: sel => { p.exam[eye][k].findings = sel; editSave(p); } })
        ]);
      }))))
    ]));

    /* 10 — lens / cataract builder */
    body.appendChild(qsec(10, 'العدسة Lens — Cataract Builder', 'exam', [
      el('div', { class: 'eyegrid' }, ['od', 'os'].map(eye => {
        const comp = el('input', { class: 'en', type: 'text', placeholder: 'مثل N III Brown + PSC II' });
        comp.value = p.exam[eye].lens.composed || composeLens(p.exam[eye].lens.findings);
        comp.addEventListener('input', () => { p.exam[eye].lens.composed = comp.value; editSave(p); });
        return eyeCol(eye, [
          pickBox({ listKey: 'lens', selected: p.exam[eye].lens.findings, gradable: true, onChange: sel => { p.exam[eye].lens.findings = sel; p.exam[eye].lens.composed = composeLens(sel); editSave(p); render(); } }),
          field('النص الطبي الناتج (قابل للتعديل)', comp)
        ]);
      }))
    ]));

    /* 11 — fundus */
    body.appendChild(qsec(11, 'قاع العين Fundus', 'exam', [
      el('div', { class: 'eyegrid' }, ['od', 'os'].map(eye => eyeCol(eye, [
        pickBox({ listKey: 'fundus', selected: p.exam[eye].fundus.findings, onChange: sel => { p.exam[eye].fundus.findings = sel; editSave(p); } })
      ])))
    ]));

    /* 12 — diagnosis */
    body.appendChild(qsec(12, 'التشخيص Diagnosis', 'diagnosis', [
      el('div', { class: 'eyegrid' }, ['od', 'os'].map(eye => {
        const kids = [];
        p.diagnoses[eye].forEach((d, i) => {
          kids.push(el('div', { class: 'frow' }, [
            el('span', { class: 'en', style: 'flex:1;font-weight:600', text: d }),
            el('button', { class: 'btn small danger', text: 'حذف', onclick: () => { p.diagnoses[eye].splice(i, 1); editSave(p); render(); } })
          ]));
        });
        const inp = el('input', { class: 'en', type: 'text', placeholder: 'اكتب أو اختر…', list: 'qdx-' + eye });
        const dl = el('datalist', { id: 'qdx-' + eye });
        getOptions('diagnosis').forEach(o => dl.appendChild(el('option', { value: o })));
        kids.push(el('div', { class: 'frow' }, [inp, dl, el('button', { class: 'btn small primary', text: '+ إضافة', onclick: () => { const v = inp.value.trim(); if (!v) return; p.diagnoses[eye].push(v); editSave(p); render(); } })]));
        return eyeCol(eye, kids);
      }))
    ]));

    /* 13 — biometry */
    body.appendChild(qsec(13, 'Biometry (AL / K1 / K2)', 'details', [
      el('div', { class: 'eyegrid' }, ['od', 'os'].map(eye => {
        const b = p.biometry[eye];
        return eyeCol(eye, [['al', 'Axial Length'], ['k1', 'K1'], ['k2', 'K2']].map(([k, lab]) =>
          el('div', { class: 'vrow' }, [el('span', { class: 'lab en', text: lab }), num(b[k], v => { b[k] = v; editSave(p); }, lab, '110px')])));
      }))
    ]));

    /* 14 — IOL power (phaco only) */
    if (!s.operation || s.operation === 'Phaco') {
      body.appendChild(qsec(14, 'IOL Power (للفاكو — لا قيمة افتراضية)', 'details', [
        el('div', { class: 'eyegrid' }, ['od', 'os'].map(eye => {
          const b = p.biometry[eye];
          return eyeCol(eye, [el('div', { class: 'vrow' }, [
            el('span', { class: 'lab en', text: 'IOL' }),
            num(b.iolPower, v => { b.iolPower = v; editSave(p); }, 'مثل +21.5', '110px')
          ])]);
        }))
      ]));
    }

    /* 15 — viral markers */
    body.appendChild(qsec(15, 'التحاليل الفيروسية', 'surgery', [
      row([field('HCV', chipsRow(D.VIRAL_OPTIONS, s.hcv, o => { OPH_SURGERY.markForReview(p, 'تعديل التحاليل الفيروسية'); s.hcv = s.hcv === o ? '' : o; savePatient(p); render(); }, true))]),
      row([field('HBV', chipsRow(D.VIRAL_OPTIONS, s.hbv, o => { OPH_SURGERY.markForReview(p, 'تعديل التحاليل الفيروسية'); s.hbv = s.hbv === o ? '' : o; savePatient(p); render(); }, true))])
    ]));

    /* footer actions */
    body.appendChild(el('div', { class: 'frow', style: 'margin-top:6px' }, [
      el('button', { class: 'btn primary', text: 'حفظ وفتح تحضير العملية', onclick: () => { savePatient(p); OPH.tab = 'surgery'; render(); } }),
      el('button', { class: 'btn', text: 'حفظ والمريض التالي', onclick: () => {
        savePatient(p);
        const i = OPH.patients.findIndex(x => x.id === p.id);
        if (i >= 0 && i + 1 < OPH.patients.length) { OPH_UTIL.selectPatient(OPH.patients[i + 1].id); OPH.tab = 'quick'; }
        else { toast('هذا آخر مريض في الجلسة'); render(); }
      } })
    ]));
  }

  window.OPH_QUICK = { render: renderQuick };
})();
