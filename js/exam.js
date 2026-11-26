/* Examination tab: dual-eye OD/OS, quick clinical entry, copy OD↔OS with undo. */
(function () {
  const { el, toast, savePatient, render, getOptions } = OPH_UTIL;
  const { pickBox, composeLens } = OPH_UI;
  const { row, field } = OPH_BUILD;
  const D = OPH_DATA;

  function renderExam(body, p) {
    D.EXAM_SECTIONS.forEach(sec => {
      if (sec.key === 'visionIop') return body.appendChild(visionCard(p));
      if (sec.key === 'refraction') return body.appendChild(refractionCard(p));
      body.appendChild(findingsCard(p, sec));
    });
  }

  /* ---------- generic findings section (dual eye) ---------- */
  function findingsCard(p, sec) {
    const card = el('div', { class: 'card' });
    card.appendChild(el('h3', { text: sec.ar + ' — ' + sec.en }));
    card.appendChild(copyRow(p, sec.key));
    const grid = el('div', { class: 'eyegrid' });
    ['od', 'os'].forEach(eye => {
      const col = el('div', { class: 'eyecol' }, [el('h4', { html: eye === 'od' ? 'العين اليمنى <span class="en">OD</span>' : 'العين اليسرى <span class="en">OS</span>' })]);
      const gradable = sec.key === 'lens';
      col.appendChild(pickBox({
        listKey: sec.key,
        selected: p.exam[eye][sec.key].findings,
        gradable,
        onChange: sel => {
          p.exam[eye][sec.key].findings = sel;
          if (gradable) p.exam[eye][sec.key].composed = composeLens(sel);
          savePatient(p);
        }
      }));
      // composed lens text (editable)
      if (gradable) {
        const comp = el('input', { class: 'en', type: 'text', placeholder: 'نص العدسة النهائي (مثل N III Brown + PSC II)' });
        comp.value = p.exam[eye][sec.key].composed || composeLens(p.exam[eye][sec.key].findings);
        comp.addEventListener('input', () => { p.exam[eye][sec.key].composed = comp.value; savePatient(p); });
        col.appendChild(field('النص المعروض في الشيت', comp));
      }
      const notes = el('textarea', { rows: 1, style: 'width:100%', placeholder: 'ملاحظات حرة' });
      notes.value = p.exam[eye][sec.key].notes || '';
      notes.addEventListener('input', () => { p.exam[eye][sec.key].notes = notes.value; savePatient(p); });
      col.appendChild(notes);
      grid.appendChild(col);
    });
    card.appendChild(grid);
    return card;
  }

  function copyRow(p, key) {
    const wrap = el('div', { class: 'copyrow' });
    let lastCopy = null;
    const undo = el('button', { class: 'btn small ghost', text: '↩ تراجع', onclick: () => {
      if (!lastCopy) return;
      p.exam.od[key] = lastCopy.od; p.exam.os[key] = lastCopy.os;
      savePatient(p); render(); toast('تم التراجع');
    }});
    function cp(from, to, label) {
      return el('button', { class: 'btn small', text: label, onclick: () => {
        lastCopy = { od: JSON.parse(JSON.stringify(p.exam.od[key])), os: JSON.parse(JSON.stringify(p.exam.os[key])) };
        p.exam[to][key] = JSON.parse(JSON.stringify(p.exam[from][key]));
        savePatient(p); render();
        toast('نُسخ ' + key + ' من ' + from.toUpperCase() + ' إلى ' + to.toUpperCase());
      }});
    }
    wrap.appendChild(cp('od', 'os', 'نسخ OD ← إلى OS'));
    wrap.appendChild(cp('os', 'od', 'نسخ OS ← إلى OD'));
    wrap.appendChild(el('button', { class: 'btn small', text: 'تطبيق OD على العينين', onclick: () => {
      lastCopy = { od: JSON.parse(JSON.stringify(p.exam.od[key])), os: JSON.parse(JSON.stringify(p.exam.os[key])) };
      p.exam.os[key] = JSON.parse(JSON.stringify(p.exam.od[key]));
      savePatient(p); render(); toast('طُبق على العينين');
    }}));
    wrap.appendChild(undo);
    return wrap;
  }

  /* ---------- vision & IOP ---------- */
  function visionCard(p) {
    const card = el('div', { class: 'card' }, [el('h3', { text: 'النظر وضغط العين — Aided Vision & IOP' })]);
    const grid = el('div', { class: 'eyegrid' });
    ['od', 'os'].forEach(eye => {
      const v = p.vision[eye], io = p.iop[eye];
      const col = el('div', { class: 'eyecol' }, [el('h4', { html: eye === 'od' ? 'العين اليمنى <span class="en">OD</span>' : 'العين اليسرى <span class="en">OS</span>' })]);
      [['unaided', 'Unaided V/A'], ['aided', 'Aided V/A'], ['pinhole', 'Pinhole V/A']].forEach(([k, lab]) => {
        const sel = el('select', { class: 'va' });
        sel.appendChild(el('option', { value: '', text: '—' }));
        D.VA_OPTIONS.forEach(o => sel.appendChild(el('option', { value: o, text: o })));
        sel.value = v[k];
        sel.addEventListener('change', () => { v[k] = sel.value; savePatient(p); render(); });
        const r = el('div', { class: 'vrow' }, [el('span', { class: 'lab en', text: lab }), sel]);
        if (v[k] === 'CF') {
          const cf = el('input', { type: 'text', placeholder: 'المسافة', style: 'width:90px;direction:ltr' });
          cf.value = v.cfDist; cf.addEventListener('input', () => { v.cfDist = cf.value; savePatient(p); });
          r.appendChild(cf);
        }
        col.appendChild(r);
      });
      // IOP
      const iopIn = el('input', { type: 'text', inputmode: 'decimal', placeholder: 'mmHg', style: 'width:100px;direction:ltr' });
      iopIn.value = io.value;
      iopIn.addEventListener('input', () => { io.value = iopIn.value; io.notMeasured = false; savePatient(p); });
      const meth = el('select', { class: 'va' });
      meth.appendChild(el('option', { value: '', text: 'الوسيلة؟' }));
      D.IOP_METHODS.forEach(m => meth.appendChild(el('option', { value: m, text: m })));
      meth.value = io.method;
      meth.addEventListener('change', () => { io.method = meth.value; savePatient(p); });
      const nm = el('button', { class: 'chip' + (io.notMeasured ? ' on' : ''), text: 'Not measured', onclick: () => { io.notMeasured = !io.notMeasured; if (io.notMeasured) io.value = ''; savePatient(p); render(); } });
      col.appendChild(el('div', { class: 'vrow' }, [el('span', { class: 'lab en', text: 'IOP' }), iopIn, meth, nm]));
      grid.appendChild(col);
    });
    card.appendChild(grid);
    return card;
  }

  /* ---------- refraction ---------- */
  function refractionCard(p) {
    const card = el('div', { class: 'card' }, [el('h3', { text: 'الانكسار — Refraction' })]);
    const grid = el('div', { class: 'eyegrid' });
    ['od', 'os'].forEach(eye => {
      const col = el('div', { class: 'eyecol' }, [el('h4', { html: eye === 'od' ? 'العين اليمنى <span class="en">OD</span>' : 'العين اليسرى <span class="en">OS</span>' })]);
      p.refraction[eye].forEach((r, i) => {
        const line = el('div', { class: 'vrow en' });
        line.appendChild(el('span', { text: (r.type || 'Auto') + ':' }));
        ['sph', 'cyl', 'axis'].forEach(k => {
          const inp = el('input', { type: 'text', inputmode: 'decimal', placeholder: k.toUpperCase(), style: 'width:72px;direction:ltr' });
          inp.value = r[k];
          inp.addEventListener('input', () => { r[k] = inp.value; savePatient(p); });
          line.appendChild(inp);
        });
        line.appendChild(el('button', { class: 'btn small danger', text: '✕', onclick: () => { p.refraction[eye].splice(i, 1); savePatient(p); render(); } }));
        col.appendChild(line);
      });
      const type = el('select', { class: 'va' });
      D.REF_TYPES.forEach(t => type.appendChild(el('option', { value: t, text: t })));
      col.appendChild(el('div', { class: 'vrow' }, [type, el('button', {
        class: 'btn small primary', text: '+ قراءة', onclick: () => {
          p.refraction[eye].push({ sph: '', cyl: '', axis: '', type: type.value }); savePatient(p); render();
        }
      })]));
      grid.appendChild(col);
    });
    card.appendChild(grid);
    return card;
  }

  window.OPH_EXAM = { render: renderExam };
})();
