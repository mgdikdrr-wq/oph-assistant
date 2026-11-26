/* Shared UI components: quick-pick chips with search/custom, option persistence. */
(function () {
  const { el, getOptions, saveSettings, toast } = OPH_UTIL;

  // Multi-select quick-pick box.
  // cfg: { listKey, selected (array of strings or {label,grade}), multi, gradable, onChange(sel), placeholder }
  function pickBox(cfg) {
    const box = el('div', { class: 'optbox' });
    const search = el('input', { class: 'optsearch', placeholder: 'بحث سريع داخل الاختيارات…', type: 'search' });
    const chips = el('div', { class: 'chips' });
    let selected = cfg.selected;

    function isSel(label) { return selected.some(s => (typeof s === 'string' ? s : s.label) === label); }
    function getSel(label) { return selected.find(s => (typeof s === 'string' ? s : s.label) === label); }

    function labelOf(s) { return typeof s === 'string' ? s : s.label; }

    function renderChips() {
      chips.innerHTML = '';
      const q = search.value.trim().toLowerCase();
      const opts = getOptions(cfg.listKey);
      opts.filter(o => !q || o.toLowerCase().includes(q)).forEach(o => {
        const sel = getSel(o);
        const chip = el('button', {
          class: 'chip en' + (sel ? ' on' : ''),
          onclick: () => toggle(o)
        });
        chip.appendChild(document.createTextNode(o));
        if (cfg.gradable && sel && sel.grade) chip.appendChild(el('span', { class: 'g', text: ' ' + sel.grade }));
        chips.appendChild(chip);
      });
      // custom entries currently selected but not in the list
      selected.forEach(s => {
        const l = labelOf(s);
        if (!opts.includes(l) && (!q || l.toLowerCase().includes(q))) {
          const chip = el('button', { class: 'chip en on', onclick: () => toggle(l) });
          chip.appendChild(document.createTextNode(l + ' ✕'));
          if (cfg.gradable && s.grade) chip.appendChild(el('span', { class: 'g', text: ' ' + s.grade }));
          chips.appendChild(chip);
        }
      });
      // grade stepper for gradable selected items
      if (cfg.gradable) {
        selected.forEach(s => {
          if (typeof s === 'object' && OPH_DATA.LENS_GRADABLE.includes(s.label)) {
            const row = el('div', { class: 'frow', style: 'margin:6px 0 0' }, [
              el('span', { class: 'en', style: 'font-weight:700', text: s.label + ': ' })
            ]);
            OPH_DATA.LENS_GRADES.forEach(g => {
              row.appendChild(el('button', {
                class: 'chip' + (s.grade === g ? ' on' : ''), text: g, onclick: () => {
                  s.grade = s.grade === g ? '' : g;
                  cfg.onChange(selected); renderChips();
                }
              }));
            });
            // Brown modifier for nuclear
            if (s.label === 'Nuclear cataract') {
              row.appendChild(el('button', {
                class: 'chip' + (s.brown ? ' on' : ''), text: 'Brown', onclick: () => { s.brown = !s.brown; cfg.onChange(selected); renderChips(); }
              }));
            }
            chips.appendChild(row);
          }
        });
      }
    }

    function toggle(label) {
      if (isSel(label)) {
        selected = selected.filter(s => labelOf(s) !== label);
      } else {
        selected.push(cfg.gradable ? { label, grade: '' } : label);
      }
      cfg.onChange(selected);
      renderChips();
    }

    // add custom option
    const addIn = el('input', { type: 'text', placeholder: cfg.placeholder || 'إضافة اختيار مخصص…', class: 'en' });
    const addBtn = el('button', {
      class: 'btn small ghost', text: '+ إضافة', onclick: () => {
        const v = addIn.value.trim(); if (!v) return;
        if (!getOptions(cfg.listKey).includes(v)) { OPH.options[cfg.listKey] = getOptions(cfg.listKey).concat([v]); saveSettings(); }
        addIn.value = '';
        if (!isSel(v)) toggle(v); else renderChips();
        toast('أُضيف "' + v + '" وحُفظ في القائمة');
      }
    });
    addIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });

    search.addEventListener('input', renderChips);
    box.appendChild(search); box.appendChild(chips);
    box.appendChild(el('div', { class: 'frow', style: 'margin-top:8px' }, [addIn, addBtn]));
    renderChips();
    return box;
  }

  // Compose lens text like "N III Brown + PSC II" (display only, doctor reviews).
  function composeLens(findings) {
    const parts = [];
    findings.forEach(f => {
      if (typeof f === 'string') { parts.push(f); return; }
      const tok = OPH_DATA.LENS_TOKENS[f.label];
      if (tok) {
        let s = tok + (f.grade ? ' ' + f.grade : '');
        if (f.label === 'Nuclear cataract' && f.brown) s += ' Brown';
        parts.push(s);
      } else parts.push(f.label);
    });
    return parts.join(' + ');
  }

  // Compose findings array to readable text for sheet/list.
  function composeFindings(sec) {
    const items = (sec.findings || []).map(f => typeof f === 'string' ? f : (OPH_DATA.LENS_TOKENS[f.label] ? (OPH_DATA.LENS_TOKENS[f.label] + (f.grade ? ' ' + f.grade : '') + (f.brown ? ' Brown' : '')) : f.label));
    let t = items.join(', ');
    if (sec.notes) t = t ? t + ' — ' + sec.notes : sec.notes;
    return t;
  }

  window.OPH_UI = { pickBox, composeLens, composeFindings };
})();
