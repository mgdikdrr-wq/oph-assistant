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

  // Professional inline SVG icons (feather-style, stroke=currentColor) instead of emoji.
  const ICONS = {
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
  };
  function icon(name, size) {
    const s = size || 18;
    return el('span', { class: 'ic', html: '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>' });
  }

  window.OPH_UI = { pickBox, composeLens, composeFindings, icon };
})();
