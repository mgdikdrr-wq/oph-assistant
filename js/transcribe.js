/* Transcription Mode: large read-only sheet view in official form order,
   prev/next, search, zoom, keep-awake, mark-as-transcribed counters. */
(function () {
  const { el, toast, savePatient, go } = OPH_UTIL;

  let idx = 0, zoom = 1, wakeLock = null, showList = false;

  function renderTranscribe(root) {
    if (!OPH.session) { go('home'); return; }
    const ps = OPH.patients;
    if (!ps.length) { root.appendChild(OPH_HOME.topbar('وضع نقل البيانات')); root.appendChild(el('p', { style: 'padding:20px', text: 'لا توجد حالات.' })); return; }
    if (idx >= ps.length) idx = 0;

    const wrap = el('div', { class: 'transcribe' });
    const done = ps.filter(p => p.sheetTranscribed).length;

    const bar = el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn small ghost', text: 'خروج', onclick: () => { releaseWake(); go('home'); } }),
      el('button', { class: 'btn small', text: '⟶ السابق', onclick: () => step(-1) }),
      el('button', { class: 'btn small', text: 'التالي ⟵', onclick: () => step(1) }),
      el('span', { class: 'en', text: (idx + 1) + ' / ' + ps.length }),
      el('span', { class: 'badge ok en', text: done + ' / ' + ps.length + ' Sheets Transcribed' }),
      el('button', { class: 'btn small', text: '🔍+', onclick: () => { zoom = Math.min(2.5, zoom + 0.15); draw(); } }),
      el('button', { class: 'btn small', text: '🔍−', onclick: () => { zoom = Math.max(0.5, zoom - 0.15); draw(); } }),
      el('button', { class: 'btn small ghost', text: showList ? 'عرض الشيتات' : 'عرض الليستة', onclick: () => { showList = !showList; draw(); } }),
      el('button', { class: 'btn small ghost', text: wakeLock ? '🔆 الشاشة مضاءة' : 'منع انطفاء الشاشة', onclick: toggleWake })
    ]);
    const search = el('input', { type: 'search', placeholder: 'بحث…', style: 'border:1px solid #ccc;border-radius:10px;padding:8px' });
    search.addEventListener('input', () => {
      const q = search.value.trim(); if (!q) return;
      const i = ps.findIndex(p => p.name.includes(q) || String(p.recordNo).includes(q));
      if (i >= 0) { idx = i; draw(); }
    });
    bar.appendChild(search);

    const p = ps[idx];
    bar.appendChild(el('button', {
      class: 'btn small ' + (p.sheetTranscribed ? 'ghost' : 'accent'),
      text: p.sheetTranscribed ? '✓ نُقلت — إلغاء العلامة؟' : 'Mark Sheet as Transcribed ✓',
      onclick: () => { p.sheetTranscribed = !p.sheetTranscribed; savePatient(p); renderTranscribe_refresh(root); }
    }));
    wrap.appendChild(bar);

    const view = el('div', { class: 'sheetview' });
    wrap.appendChild(view);
    root.appendChild(wrap);

    function draw() {
      view.innerHTML = '';
      if (showList) {
        const pages = OPH_SVG.listSVGs(OPH_SLIST.listPatients(), OPH_EXPORT.svgSettings());
        pages.forEach(pg => {
          const holder = el('div', { style: 'margin-bottom:16px' });
          holder.innerHTML = pg.svg;
          const svg = holder.querySelector('svg');
          svg.style.width = Math.round(pg.w / 3 * zoom) + 'px'; svg.style.height = 'auto';
          view.appendChild(holder);
        });
      } else {
        const pg = OPH_SVG.sheetSVG(ps[idx], OPH_EXPORT.svgSettings());
        const holder = el('div');
        holder.innerHTML = pg.svg;
        const svg = holder.querySelector('svg');
        svg.style.width = Math.round(pg.w / 3 * zoom) + 'px'; svg.style.height = 'auto';
        view.appendChild(holder);
      }
    }
    function step(d) { idx = (idx + d + ps.length) % ps.length; renderTranscribe_refresh(root); }
    draw();
  }

  function renderTranscribe_refresh(root) {
    root.innerHTML = '';
    renderTranscribe(root);
  }

  async function toggleWake() {
    try {
      if (wakeLock) { wakeLock.release(); wakeLock = null; }
      else if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); toast('الشاشة لن تنطفئ أثناء النقل'); }
      else toast('المتصفح لا يدعم منع الانطفاء');
    } catch (e) { toast('تعذر منع الانطفاء'); }
    OPH_UTIL.render();
  }
  function releaseWake() { if (wakeLock) { wakeLock.release(); wakeLock = null; } }

  window.OPH_TRANS = { render: renderTranscribe };
})();
