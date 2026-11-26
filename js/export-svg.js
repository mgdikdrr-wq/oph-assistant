/* Export engine: builds official-form SVGs programmatically from data.
   Sheet: A4 portrait. Surgical list: A4 landscape, paginated.
   No generative AI — deterministic text layout; Arabic text drawn by the browser's own shaping. */
(function () {
  const { esc } = OPH_UTIL;
  const { bestVA } = OPH_DB;

  const A4P = { w: 2480, h: 3508 };   // A4 portrait @300dpi
  const A4L = { w: 3508, h: 2480 };   // A4 landscape @300dpi

  // rough text width estimate (fraction of font-size per char)
  function tw(t, fs) {
    let w = 0;
    for (const ch of String(t)) {
      const code = ch.codePointAt(0);
      if (code >= 0x0600 && code <= 0x06FF) w += 0.62;      // Arabic
      else if (ch === ' ') w += 0.3;
      else if ('ilj.,:;\'/'.includes(ch)) w += 0.28;
      else if ('mwMW'.includes(ch)) w += 0.85;
      else w += 0.55;
    }
    return w * fs;
  }
  function wrapText(t, fs, maxW) {
    const words = String(t || '').split(/\s+/).filter(Boolean);
    const lines = []; let cur = '';
    for (const wd of words) {
      const tryT = cur ? cur + ' ' + wd : wd;
      if (tw(tryT, fs) > maxW && cur) { lines.push(cur); cur = wd; }
      else cur = tryT;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }
  function isArabic(t) { return /[؀-ۿ]/.test(t); }
  function dxAllIncludes(p, dx) {
    const all = p.diagnoses.od.concat(p.diagnoses.os, p.diagnoses.ou, [p.diagnoses.suggested || '']);
    return all.some(d => d && d.trim() === String(dx).trim());
  }

  function svgOpen(w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="'Noto Naskh Arabic','Geeza Pro','Noto Sans',Arial,sans-serif">`;
  }
  function text(x, y, t, fs, opts) {
    opts = opts || {};
    let anchor = opts.anchor || 'start'; // geometric: start=grow right from x, end=right edge at x
    const weight = opts.bold ? ' font-weight="700"' : '';
    const fill = opts.fill || '#111';
    const ar = isArabic(t);
    const dir = ar ? ' direction="rtl"' : ' direction="ltr"';
    if (ar) anchor = anchor === 'start' ? 'end' : anchor === 'end' ? 'start' : anchor; // RTL swaps SVG anchor geometry
    return `<text x="${x}" y="${y}" font-size="${fs}"${weight} fill="${fill}" text-anchor="${anchor}"${dir}>${esc(t)}</text>`;
  }
  function rect(x, y, w, h, opts) {
    opts = opts || {};
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${opts.fill || 'none'}" stroke="${opts.stroke || '#111'}" stroke-width="${opts.sw || 3}"/>`;
  }
  function line(x1, y1, x2, y2, sw) { return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="${sw || 3}"/>`; }

  /* ================= Ophthalmology Sheet (A4 portrait) ================= */
  // Back-compat: first page of the sheet. Full page set via sheetSVGAll.
  function sheetSVG(p, settings) { return sheetSVGAll(p, settings)[0]; }

  // Long sheets shrink to fit one page while readable (k >= 0.55); beyond that
  // they continue onto extra A4 pages. Long medical text is never clipped.
  function sheetSVGAll(p, settings) {
    const W = A4P.w, H = A4P.h, M = 90, usable = H - 110;
    const built = buildContent(p, settings);
    let k = 1;
    if (built.endY > usable) k = Math.max(0.55, usable / built.endY);
    const nPages = Math.max(1, Math.ceil(built.endY * k / usable));
    const pages = [];
    for (let i = 0; i < nPages; i++) {
      let s = svgOpen(W, H);
      s += rect(0, 0, W, H, { fill: '#fff', stroke: 'none' });
      s += '<clipPath id="pgclip"><rect x="0" y="0" width="' + W + '" height="' + usable + '"/></clipPath>';
      s += '<g clip-path="url(#pgclip)"><g transform="translate(0 ' + (-i * usable) + ') scale(' + k + ')">';
      s += built.content;
      s += '</g></g>';
      s += text(W - M, H - 60, 'مطابع وزارة الصحة والسكان', 32, { anchor: 'end', fill: '#666' });
      if (nPages > 1) s += text(M, H - 60, 'صفحة ' + (i + 1) + ' / ' + nPages, 34, { fill: '#666' });
      s += '</svg>';
      pages.push({ svg: s, w: W, h: H, endY: built.endY, k: k, pageCount: nPages });
    }
    return pages;
  }

  function buildContent(p, settings) {
    const W = A4P.w, M = 90; // margin
    const FS = 46, FSS = 40;
    let s = '';
    let y = M + 30;

    // header block (RTL, right-aligned)
    const rx = W - M;
    s += text(rx, y, 'وزارة الصحة والسكان', FS + 6, { anchor: 'end', bold: true }); y += 62;
    s += text(rx, y, 'أمانة المراكز الطبية المتخصصة', FS, { anchor: 'end' }); y += 62;
    s += text(rx, y, settings.hospitalName, FS, { anchor: 'end', bold: true });
    // patient name & record no (left of header, like the form)
    s += text(M, y - 124, 'اسم المريض رباعي: ' + (p.name || ''), FS, { anchor: 'start', bold: true });
    s += text(M, y - 62, 'رقم الملف الطبي: ' + (p.recordNo || ''), FS);
    y += 40;

    // title bar
    s += rect(M, y, W - 2 * M, 80, { fill: '#e8eef4' });
    s += text(W / 2, y + 56, 'OPHTHALMOLOGY OUTPATIENT CLINIC', FS + 4, { anchor: 'middle', bold: true });
    y += 80 + 26;

    // info lines
    const fv = p.visitType === 'first' ? 'Yes' : p.visitType === 'followup' ? 'Follow-up' : '';
    s += text(M, y, `Date: ${p.date || ''}        Time: ${p.time || ''}        First visit: ${fv}`, FSS); y += 64;
    const gm = p.gender === 'M' ? '☒' : '☐', gf = p.gender === 'F' ? '☒' : '☐';
    s += text(M, y, `Gender:  F ${gf}      M ${gm}                                     AGE: ${p.age || ''}`, FSS); y += 64;

    function labelLine(label, val) {
      const lines = wrapText(val, FSS, W - 2 * M - 560);
      s += text(M, y, label, FSS, { bold: true });
      lines.forEach((ln, i) => {
        s += text(M + 560, y + i * 56, ln, FSS);
      });
      y += Math.max(1, lines.length) * 56 + 10;
      s += line(M, y - 22, W - M, y - 22, 1.5);
    }
    const pastH = p.pastHistory.map(h => [h.item, h.eye, h.date, h.details].filter(Boolean).join(' ')).join('; ');
    const complaint = [p.complaint.items.map(x => typeof x === 'string' ? x : x.label).join(', '),
      [p.complaint.eye, p.complaint.duration, p.complaint.onset, p.complaint.progression].filter(Boolean).join(' / '),
      p.complaint.notes].filter(Boolean).join(' — ');
    const systemic = p.systemic.join(' / ');
    const dxAll = []
      .concat(p.diagnoses.od.length ? ['OD: ' + p.diagnoses.od.join(', ')] : [])
      .concat(p.diagnoses.os.length ? ['OS: ' + p.diagnoses.os.join(', ')] : [])
      .concat(p.diagnoses.ou.length ? ['OU: ' + p.diagnoses.ou.join(', ')] : [])
      .concat(p.diagnoses.suggested ? [p.diagnoses.suggested] : [])
      .concat(p.surgery.diagnosisText && !dxAllIncludes(p, p.surgery.diagnosisText) ? [p.surgery.diagnosisText] : []);
    labelLine('Past History :', pastH);
    labelLine('Complaint :', complaint);
    labelLine('Systemic diseases :', systemic);
    labelLine('Diagnosis :', dxAll.join(' | '));
    y += 8;

    // Examination table
    const colL = M, colW1 = 620, colW2 = (W - 2 * M - colW1) / 2;
    const colR = colL + colW1, col3 = colR + colW2, colE = W - M;
    function examHeader() {
      s += rect(colL, y, colW1, 70, { fill: '#eef2f6' });
      s += rect(colR, y, colW2, 70, { fill: '#eef2f6' });
      s += rect(col3, y, colW2, 70, { fill: '#eef2f6' });
      s += text(colL + colW1 / 2, y + 48, 'Examination', FS, { anchor: 'middle', bold: true });
      s += text(colR + colW2 / 2, y + 48, 'Right Eye', FS, { anchor: 'middle', bold: true });
      s += text(col3 + colW2 / 2, y + 48, 'Left Eye', FS, { anchor: 'middle', bold: true });
      y += 70;
    }
    examHeader();

    function vaText(e) {
      const v = p.vision[e], io = p.iop[e];
      const parts = [];
      if (v.unaided) parts.push('Unaided: ' + v.unaided + (v.unaided === 'CF' && v.cfDist ? ' ' + v.cfDist : ''));
      if (v.aided) parts.push('Aided: ' + v.aided + (v.aided === 'CF' && v.cfDist ? ' ' + v.cfDist : ''));
      if (v.pinhole) parts.push('PH: ' + v.pinhole);
      if (io.notMeasured) parts.push('IOP: Not measured');
      else if (io.value) parts.push('IOP: ' + io.value + ' mmHg' + (io.method ? ' (' + io.method + ')' : ''));
      return parts.join('\n');
    }
    function refText(e) {
      return p.refraction[e].map(r => `${r.type || 'Auto'}: ${r.sph} / ${r.cyl} x ${r.axis}`).join('\n');
    }
    function secText(e, key) {
      if (key === 'visionIop') return vaText(e);
      if (key === 'refraction') return refText(e);
      const sec = p.exam[e][key];
      let t = OPH_UI.composeFindings(sec);
      if (key === 'lens' && sec.composed) t = sec.composed + (sec.notes ? ' — ' + sec.notes : '');
      return t;
    }

    OPH_DATA.EXAM_SECTIONS.forEach(sec => {
      const tOD = secText('od', sec.key), tOS = secText('os', sec.key);
      // split explicit newlines, then wrap
      function linesFor(t) {
        const out = [];
        String(t || '').split('\n').forEach(seg => wrapText(seg, FSS, colW2 - 40).forEach(l => out.push(l)));
        return out.length ? out : [''];
      }
      const lOD = linesFor(tOD), lOS = linesFor(tOS);
      const nLines = Math.max(lOD.length, lOS.length, 1);
      const rh = nLines * 54 + 26;
      s += rect(colL, y, colW1, rh); s += rect(colR, y, colW2, rh); s += rect(col3, y, colW2, rh);
      s += text(colL + 20, y + 50, sec.en, FSS, { bold: true });
      lOD.forEach((ln, i) => s += text(colR + 20, y + 50 + i * 54, ln, FSS));
      lOS.forEach((ln, i) => s += text(col3 + 20, y + 50 + i * 54, ln, FSS));
      y += rh;
    });
    y += 20;

    // Investigations table
    function threeCol(title, cols, rows) {
      const cw = (W - 2 * M) / cols.length;
      s += text(M, y, title, FS, { bold: true }); y += 16;
      let x = M;
      cols.forEach(c => { s += rect(x, y, cw, 66, { fill: '#eef2f6' }); s += text(x + cw / 2, y + 46, c, FSS, { anchor: 'middle', bold: true }); x += cw; });
      y += 66;
      const maxRows = Math.max(rows[0].length, rows[1].length, rows[2].length, 1);
      for (let r = 0; r < maxRows; r++) {
        const cellLines = rows.map(colRows => colRows[r] ? wrapText(colRows[r], FSS, cw - 30) : ['']);
        const rh = Math.max.apply(null, cellLines.map(c => c.length)) * 52 + 20;
        let xx = M;
        cellLines.forEach((cls, ci) => {
          s += rect(xx, y, cw, rh);
          cls.forEach((ln, li) => s += text(xx + 16, y + 46 + li * 52, ln, FSS));
          xx += cw;
        });
        y += rh;
      }
      y += 24;
    }
    threeCol('Investigations :', ['Current', 'Requested', 'Results'], [
      p.investigations.current.map(r => r.item + (r.result ? ' — ' + r.result : '')),
      p.investigations.requested.map(r => r.item + (r.result ? ' — ' + r.result : '')),
      p.investigations.results.map(r => r.item + (r.result ? ' — ' + r.result : ''))
    ]);
    threeCol('Treatment', ['Current', 'Recommended'], [
      p.treatment.current.map(t => [t.drug, t.eye, t.freq, t.duration].filter(Boolean).join(' — ')),
      p.treatment.recommended.map(t => [t.drug, t.eye, t.freq, t.duration].filter(Boolean).join(' — ')),
      []
    ]);

    // Biometry block (if any)
    const bOD = p.biometry.od, bOS = p.biometry.os;
    const hasB = ['od', 'os'].some(e => { const b = p.biometry[e]; return b.al || b.k1 || b.k2 || b.iolPower; });
    if (hasB) {
      s += text(M, y, 'Biometry & IOL :', FS, { bold: true }); y += 56;
      ['od', 'os'].forEach(e => {
        const b = p.biometry[e];
        const parts = [];
        if (b.al) parts.push('AL: ' + b.al);
        if (b.k1) parts.push('K1: ' + b.k1);
        if (b.k2) parts.push('K2: ' + b.k2);
        if (b.acd) parts.push('ACD: ' + b.acd);
        if (b.iolPower) parts.push('IOL Power: ' + b.iolPower + ' D');
        if (b.targetRef) parts.push('Target: ' + b.targetRef);
        if (b.iolModel) parts.push(b.iolModel);
        if (parts.length) { s += text(M, y, e.toUpperCase() + ':  ' + parts.join('   '), FSS); y += 54; }
      });
      y += 10;
    }

    // signature (left empty)
    s += text(M, y + 30, 'Signature : ...............................................', FSS);
    return { content: s, endY: y + 90 };
  }

  /* ================= Surgical List (A4 landscape, paginated) ================= */
  function listSVGs(ps, settings) {
    const W = A4L.w, H = A4L.h, M = 80;
    const FS = 42, FSS = 38;
    const cols = [
      { t: 'No', w: 90 }, { t: 'Patient Name\nاسم المريض', w: 560, ar: true }, { t: 'Record NO\nرقم الملف', w: 220 },
      { t: 'Age\nالسن', w: 130 }, { t: 'Medically', w: 300 }, { t: 'V/A', w: 190 },
      { t: 'Diagnosis', w: 460 }, { t: 'Operation', w: 300 }, { t: 'HCV\nHBV', w: 200 },
      { t: 'IOL\nPOWER', w: 200 }, { t: 'توقيع\nالطبيب الجراح', w: 330, ar: true }, { t: 'توقيع\nب التخدير', w: 330, ar: true }
    ];
    const tableW = cols.reduce((a, c) => a + c.w, 0);
    const headerH = 120, rowMin = 120;
    const topH = 300; // hospital header + date
    const usable = H - M - topH - 60;

    const pages = [];
    let rows = [], rowsH = 0;
    function rowLines(p) {
      const d = OPH_SLIST.rowData(p);
      return [d.name, String(d.recordNo || ''), String(d.age || ''), d.medically, d.va, d.dx, d.op, d.viral, d.iol, '', ''];
    }
    function rowHeight(p) {
      const vals = rowLines(p);
      let mx = 1;
      vals.forEach((v, i) => {
        const cw = cols[i + 1].w - 24;
        mx = Math.max(mx, wrapText(v, FSS, cw).length);
      });
      return Math.max(rowMin, mx * 50 + 30);
    }

    ps.forEach(p => {
      const rh = rowHeight(p);
      if (rowsH + rh > usable && rows.length) { pages.push(rows); rows = []; rowsH = 0; }
      rows.push({ p, rh }); rowsH += rh;
    });
    if (rows.length || !pages.length) pages.push(rows);

    let no = 1;
    return pages.map(pageRows => {
      let s = svgOpen(W, H);
      s += rect(0, 0, W, H, { fill: '#fff', stroke: 'none' });
      let y = M;
      // header
      s += text(W - M, y, 'وزارة الصحة والسكان', FS + 4, { anchor: 'end', bold: true }); y += 58;
      s += text(W - M, y, 'أمانة المراكز الطبية المتخصصة', FS, { anchor: 'end' }); y += 58;
      s += text(W - M, y, settings.hospitalName, FS, { anchor: 'end', bold: true });
      s += text(W / 2, M + 20, 'List', FS + 6, { anchor: 'middle', bold: true });
      s += text(W / 2, M + 84, 'ليستة العمليات الكبرى ليوم', FS + 2, { anchor: 'middle', bold: true });
      s += text(W / 2 - 400, M + 84, settings._surgeryDate || '', FS + 2, { anchor: 'end', bold: true });
      y = M + topH - 40;

      // table header — official column order left→right: No, Name, Record, Age, ...
      let x = M;
      const xs = [];
      cols.forEach(c => { xs.push(x); x += c.w; });
      // header cells
      cols.forEach((c, i) => {
        s += rect(xs[i], y, cols[i].w, headerH, { fill: '#dbe6f2' });
        const lines = c.t.split('\n');
        lines.forEach((ln, li) => {
          s += text(xs[i] + cols[i].w / 2, y + 46 + li * 44, ln, FSS, { anchor: 'middle', bold: true, fill: '#17365d' });
        });
      });
      y += headerH;

      pageRows.forEach(({ p, rh }) => {
        const vals = rowLines(p);
        // No column
        s += rect(xs[0], y, cols[0].w, rh);
        s += text(xs[0] + cols[0].w / 2, y + rh / 2 + 14, String(no), FSS, { anchor: 'middle' });
        vals.forEach((v, i) => {
          const ci = i + 1;
          s += rect(xs[ci], y, cols[ci].w, rh);
          const lines = wrapText(v, FSS, cols[ci].w - 24);
          const startY = y + 44;
          lines.forEach((ln, li) => {
            const anchor = isArabic(ln) ? 'end' : 'start';   // geometric: Arabic right-aligned in cell
            const tx = isArabic(ln) ? xs[ci] + cols[ci].w - 12 : xs[ci] + 12;
            s += text(tx, startY + li * 50, ln, FSS, { anchor });
          });
        });
        y += rh; no++;
      });
      s += text(M, H - 40, 'صفحة ' + (pages.indexOf(pageRows) + 1) + ' / ' + pages.length, FSS - 6, { fill: '#666' });
      s += text(W - M, H - 40, 'مطابع وزارة الصحة والسكان', FSS - 6, { anchor: 'end', fill: '#666' });
      s += '</svg>';
      return { svg: s, w: W, h: H };
    });
  }

  window.OPH_SVG = { sheetSVG, sheetSVGAll, listSVGs, A4P, A4L };
})();
