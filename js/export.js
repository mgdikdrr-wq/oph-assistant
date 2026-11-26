/* Export view: PNG/JPEG/PDF generation from SVGs at 300/600 DPI, preview, print, save. */
(function () {
  const { el, toast, go } = OPH_UTIL;

  // iPadOS Safari refuses canvases above ~16.7M pixels (blank output), so cap
  // the effective scale: 600 DPI A4 would need ~35MP and must degrade safely.
  const MAX_CANVAS_PX = 16000000;
  let dpiCapped = false;
  // Render an SVG string to a PNG/JPEG blob at the chosen DPI.
  function svgToImage(svgStr, w, h, dpi, type) {
    let scale = dpi / 300;
    const maxScale = Math.sqrt(MAX_CANVAS_PX / (w * h));
    if (scale > maxScale) {
      scale = maxScale;
      if (!dpiCapped) { dpiCapped = true; OPH_UTIL.toast('خُفضت دقة التصدير تلقائيًا إلى أقصى ما يدعمه الجهاز'); }
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), type || 'image/png', 0.95);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  function blobToDataURL(b) {
    return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  }

  // iOS drops rapid-fire programmatic downloads; space them out.
  let dlChain = Promise.resolve();
  function download(blob, filename) {
    dlChain = dlChain.then(() => new Promise(res => setTimeout(() => {
      const a = el('a', { href: URL.createObjectURL(blob), download: filename });
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      res();
    }, 350)));
  }

  function svgSettings() {
    return Object.assign({}, OPH.settings, { _surgeryDate: OPH.session ? OPH.session.surgeryDate : '' });
  }

  // A sheet may span several A4 pages (long content is paginated, never clipped).
  async function makeSheetPNGs(p, dpi, type) {
    const pages = OPH_SVG.sheetSVGAll(p, svgSettings());
    const out = [];
    for (const pg of pages) out.push(await svgToImage(pg.svg, pg.w, pg.h, dpi, type));
    return out;
  }
  async function makeListPNGs(dpi, type) {
    const pages = OPH_SVG.listSVGs(OPH_SLIST.listPatients(), svgSettings());
    const out = [];
    for (const pg of pages) out.push(await svgToImage(pg.svg, pg.w, pg.h, dpi, type));
    return out;
  }

  async function makePDF(kind, dpi) {
    const { jsPDF } = window.jspdf;
    const pngs = [];
    if (kind === 'list' || kind === 'all') {
      for (const b of await makeListPNGs(dpi, 'image/jpeg')) pngs.push({ b, orient: 'l' });
    }
    if (kind === 'sheets' || kind === 'all') {
      for (const p of OPH.patients) for (const b of await makeSheetPNGs(p, dpi, 'image/jpeg')) pngs.push({ b, orient: 'p' });
    }
    if (kind === 'sheet-one' && OPH.patient) for (const b of await makeSheetPNGs(OPH.patient, dpi, 'image/jpeg')) pngs.push({ b, orient: 'p' });
    if (!pngs.length) throw new Error('لا يوجد محتوى للتصدير');
    let doc = null;
    for (const { b, orient } of pngs) {
      const dataUrl = await blobToDataURL(b);
      if (!doc) doc = new jsPDF({ orientation: orient === 'l' ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
      else doc.addPage('a4', orient === 'l' ? 'landscape' : 'portrait');
      const pw = orient === 'l' ? 297 : 210, ph = orient === 'l' ? 210 : 297;
      doc.addImage(dataUrl, 'JPEG', 0, 0, pw, ph);
    }
    return doc.output('blob');
  }

  // Never export the list as final while listed cases are still incomplete (§9).
  function guardList(fn) {
    const incomplete = OPH.patients.filter(p => p.inList && OPH_DB.status(p) !== 'completed');
    if (incomplete.length) {
      OPH_UTIL.confirmModal('حالات غير مكتملة في الليستة',
        'يوجد ' + incomplete.length + ' حالة غير مكتملة التحضير: ' + incomplete.map(p => p.name || 'بدون اسم').slice(0, 5).join('، ') + (incomplete.length > 5 ? '…' : '') + '. تصدير الليستة الآن يصدّر حالات ناقصة. متابعة على أي حال؟',
        fn, 'متابعة التصدير');
      return;
    }
    fn();
  }

  function renderExport(root) {
    if (!OPH.session) { go('home'); return; }
    root.appendChild(OPH_HOME.topbar('تصدير المخرجات'));
    const wrap = el('div', { class: 'screen home' });

    const dpiSel = el('select', { class: 'va' });
    [300, 600].forEach(d => dpiSel.appendChild(el('option', { value: d, text: d + ' DPI' })));
    dpiSel.value = String(OPH.settings.exportDpi || 300);

    const card = el('div', { class: 'home-card' }, [
      el('h3', { text: 'جودة التصدير' }),
      el('div', { class: 'frow' }, [dpiSel])
    ]);
    wrap.appendChild(card);

    async function busy(fn, label) {
      toast('جاري إنشاء ' + label + '…');
      try { await fn(); } catch (e) { toast('خطأ: ' + (e.message || e)); console.error(e); }
    }

    const bcard = el('div', { class: 'home-card' }, [el('div', { class: 'home-buttons' }, [
      el('button', { class: 'btn primary', text: 'تصدير شيت المريض الحالي PNG', onclick: () => busy(async () => {
        if (!OPH.patient) throw new Error('لا يوجد مريض محدد');
        const bs = await makeSheetPNGs(OPH.patient, +dpiSel.value, 'image/png');
        bs.forEach((b, i) => download(b, 'sheet-' + (OPH.patient.recordNo || OPH.patient.caseNo) + (bs.length > 1 ? '-p' + (i + 1) : '') + '.png'));
      }, 'الشيت') }),
      el('button', { class: 'btn primary', text: 'تصدير كل الشيتات PNG', onclick: () => busy(async () => {
        for (const p of OPH.patients) {
          const bs = await makeSheetPNGs(p, +dpiSel.value, 'image/png');
          bs.forEach((b, i) => download(b, 'sheet-' + (p.recordNo || p.caseNo) + (bs.length > 1 ? '-p' + (i + 1) : '') + '.png'));
        }
      }, 'الشيتات') }),
      el('button', { class: 'btn primary', text: 'تصدير الليستة PNG', onclick: () => guardList(() => busy(async () => {
        const bs = await makeListPNGs(+dpiSel.value, 'image/png');
        bs.forEach((b, i) => download(b, 'surgical-list-' + (i + 1) + '.png'));
      }, 'الليستة')) }),
      el('button', { class: 'btn accent', text: 'PDF — الليستة فقط', onclick: () => guardList(() => busy(async () => {
        download(await makePDF('list', +dpiSel.value), 'surgical-list.pdf');
      }, 'PDF')) }),
      el('button', { class: 'btn accent', text: 'PDF — كل الشيتات', onclick: () => busy(async () => {
        download(await makePDF('sheets', +dpiSel.value), 'sheets.pdf');
      }, 'PDF') }),
      el('button', { class: 'btn accent', text: 'PDF واحد — الليستة + الشيتات', onclick: () => guardList(() => busy(async () => {
        download(await makePDF('all', +dpiSel.value), 'ophthalmology-' + (OPH.session.prepDate || '') + '.pdf');
      }, 'PDF')) }),
      el('button', { class: 'btn', text: 'معاينة شيت المريض الحالي', onclick: () => preview(OPH.patient) }),
      el('button', { class: 'btn ghost', text: 'طباعة (AirPrint)', onclick: () => window.print() })
    ])]);
    wrap.appendChild(bcard);

    const note = el('div', { class: 'home-card' }, [
      el('p', { text: 'تُحفظ الملفات عبر مشاركة iPadOS — اختر "حفظ في الملفات". لا تُحفظ أي بيانات في معرض الصور تلقائيًا.' })
    ]);
    wrap.appendChild(note);

    // preview pane
    const pv = el('div', { class: 'home-card', id: 'preview-pane' });
    wrap.appendChild(pv);
    root.appendChild(wrap);

    function preview(p) {
      if (!p) { toast('لا يوجد مريض محدد'); return; }
      const pages = OPH_SVG.sheetSVGAll(p, svgSettings());
      pv.innerHTML = '';
      pv.appendChild(el('h3', { text: 'معاينة — ' + (p.name || '') + (pages.length > 1 ? ' (' + pages.length + ' صفحات)' : '') }));
      const holder = el('div', { style: 'overflow:auto;max-height:70vh;background:#fff' });
      pages.forEach(pg => {
        const d = el('div', {});
        d.innerHTML = pg.svg; // engine output: every dynamic string is esc()-escaped
        const svgEl = d.querySelector('svg');
        if (svgEl) { svgEl.style.maxWidth = '100%'; svgEl.style.height = 'auto'; }
        holder.appendChild(d);
      });
      pv.appendChild(holder);
    }
  }

  window.OPH_EXPORT = { render: renderExport, svgToImage, makeSheetPNGs, makeListPNGs, makePDF, svgSettings, download };
})();
