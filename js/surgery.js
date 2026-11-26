/* Surgical Preparation tab: operation, operative eye, viral markers, review & approval.
   Error-prevention per directive §18: operative-eye data only, re-review on change. */
(function () {
  const { el, toast, confirmModal, savePatient, render, getOptions } = OPH_UTIL;
  const { checklist, bestVA, status } = OPH_DB;
  const { field } = OPH_BUILD;
  const D = OPH_DATA;

  function renderSurgery(body, p) {
    const s = p.surgery;
    const card = el('div', { class: 'card' }, [el('h3', { text: 'العملية المقررة' })]);

    // operation chips (only the 3 used + custom from settings)
    const opChips = el('div', { class: 'chips' });
    getOptions('operations').forEach(op => {
      opChips.appendChild(el('button', {
        class: 'chip en' + (s.operation === op ? ' on' : ''), text: op, onclick: () => {
          if (s.operation !== op) markForReview(p, 'تغيرت العملية');
          s.operation = s.operation === op ? '' : op;
          if (s.operation !== 'Phaco') s.iolPower = ''; // IOL not applicable
          savePatient(p); render();
        }
      }));
    });
    card.appendChild(field('العملية', opChips));

    // operative eye
    const eyeChips = el('div', { class: 'chips' });
    ['OD', 'OS'].forEach(e => {
      eyeChips.appendChild(el('button', {
        class: 'chip en' + (s.eye === e ? ' on' : ''), text: e === 'OD' ? 'OD — يمنى' : 'OS — يسرى', onclick: () => {
          if (s.eye && s.eye !== e) {
            markForReview(p, 'تغيرت العين المقررة');
            // eye-specific manual overrides belong to the old eye; never carry them across
            s.vaText = ''; s.diagnosisText = ''; s.iolPower = '';
            toast('تنبيه: تغيرت العين — مُسحت القيم المرتبطة بالعين السابقة (V/A والتشخيص وIOL) وستُسحب الآن من ' + e + '. راجعها قبل الاعتماد.');
          }
          s.eye = s.eye === e ? '' : e;
          savePatient(p); render();
        }
      }));
    });
    card.appendChild(field('العين المقرر إجراء العملية عليها', eyeChips));

    // pulled data (operative eye only)
    if (s.eye) {
      const ek = s.eye.toLowerCase();
      const va = bestVA(p, s.eye);
      const dxList = p.diagnoses[ek].concat(p.diagnoses.ou);
      const iol = p.biometry[ek].iolPower;
      const pullCard = el('div', { class: 'card' }, [el('h3', { text: 'البيانات المسحوبة من العين ' + s.eye + ' فقط' })]);
      const vaIn = el('input', { class: 'en', type: 'text', placeholder: 'V/A للعين ' + s.eye });
      vaIn.value = s.vaText || va;
      vaIn.addEventListener('input', () => { s.vaText = vaIn.value; savePatient(p); refreshReview(p); });
      pullCard.appendChild(field('حدة الإبصار V/A (' + s.eye + ')', vaIn));

      const dxIn = el('input', { class: 'en', type: 'text', placeholder: 'التشخيص', list: 'surg-dx' });
      dxIn.value = s.diagnosisText || dxList[0] || p.diagnoses.suggested || '';
      const dl = el('datalist', { id: 'surg-dx' });
      dxList.concat(p.diagnoses.suggested ? [p.diagnoses.suggested] : []).forEach(d => dl.appendChild(el('option', { value: d })));
      dxIn.addEventListener('input', () => { s.diagnosisText = dxIn.value; savePatient(p); refreshReview(p); });
      pullCard.appendChild(field('التشخيص', dxIn)); pullCard.appendChild(dl);

      if (s.operation === 'Phaco') {
        const iolIn = el('input', { class: 'en', type: 'text', inputmode: 'decimal', placeholder: '+21.5' });
        iolIn.value = s.iolPower || iol;
        iolIn.addEventListener('input', () => { s.iolPower = iolIn.value; savePatient(p); refreshReview(p); });
        pullCard.appendChild(field('IOL Power للعين ' + s.eye + ' (من Biometry)', iolIn));
      }
      body.appendChild(card);
      body.appendChild(pullCard);
    } else {
      body.appendChild(card);
    }

    // viral markers
    const vCard = el('div', { class: 'card' }, [el('h3', { text: 'التحاليل الفيروسية Viral Markers' })]);
    [['hcv', 'HCV'], ['hbv', 'HBV']].forEach(([k, lab]) => {
      const chips = el('div', { class: 'chips' });
      D.VIRAL_OPTIONS.forEach(o => {
        chips.appendChild(el('button', {
          class: 'chip en' + (s[k] === o ? ' on' : ''), text: o, onclick: () => {
            s[k] = s[k] === o ? '' : o; savePatient(p); render();
          }
        }));
      });
      vCard.appendChild(field(lab + ' (لا يوجد افتراض تلقائي)', chips));
    });
    body.appendChild(vCard);

    // notes
    const nCard = el('div', { class: 'card' }, [el('h3', { text: 'ملاحظات إضافية للتحضير' })]);
    const n = el('textarea', { rows: 2, style: 'width:100%' }); n.value = s.notes;
    n.addEventListener('input', () => { s.notes = n.value; savePatient(p); });
    nCard.appendChild(n);
    body.appendChild(nCard);

    const rv = el('div', { id: 'review-holder' });
    rv.appendChild(reviewCard(p));
    body.appendChild(rv);
  }

  function refreshReview(p) {
    const rv = document.getElementById('review-holder');
    if (!rv) return;
    rv.innerHTML = '';
    rv.appendChild(reviewCard(p));
  }

  function markForReview(p, why) {
    if (p.reviewApproved) {
      p.needsReview = true; p.reviewApproved = false;
      if (p.sheetTranscribed || p.listTranscribed) {
        toast('تنبيه: ' + why + ' وقد نُقلت الحالة للورق بالفعل — يلزم إعادة النقل بعد المراجعة.');
      }
    }
  }

  /* ---------- review & approval ---------- */
  function reviewCard(p) {
    const card = el('div', { class: 'card' });
    card.appendChild(el('h3', { text: 'مراجعة الحالة قبل الاعتماد' }));
    const items = checklist(p);
    items.forEach(i => {
      card.appendChild(el('div', { class: 'checkline ' + (i.ok ? 'ok' : 'bad') }, [
        el('span', { class: 'st', text: i.ok ? '✅' : '⚠️' }),
        el('span', { text: i.ar })
      ]));
    });
    const allOk = items.every(i => i.ok);
    const st = status(p);
    card.appendChild(el('div', { class: 'frow', style: 'margin-top:10px' }, [
      el('span', { class: 'badge ' + (st === 'completed' ? 'ok' : st === 'ready' ? 'done' : 'warn'), text: 'الحالة: ' + D.STATUS[st].ar }),
      p.needsReview ? el('span', { class: 'badge warn', text: 'يحتاج إعادة مراجعة بعد تعديل' }) : null
    ]));
    const row2 = el('div', { class: 'frow', style: 'margin-top:10px' });
    row2.appendChild(el('button', {
      class: 'btn accent', disabled: allOk ? null : 'disabled',
      text: p.needsReview ? 'إعادة اعتماد بعد المراجعة' : 'اعتماد الحالة (مكتملة التحضير)',
      onclick: () => {
        p.reviewApproved = true; p.needsReview = false; savePatient(p); refreshReview(p);
        toast('اعتُمدت الحالة كمكتملة التحضير');
      }
    }));
    if (!p.inList) {
      row2.appendChild(el('button', {
        class: 'btn primary', text: 'إضافة إلى ليستة العمليات', onclick: () => {
          if (!p.surgery.operation || !p.surgery.eye) { toast('حدد العملية والعين أولًا'); return; }
          p.inList = true; savePatient(p); toast('أُضيفت الحالة إلى الليستة');
        }
      }));
    } else {
      row2.appendChild(el('button', {
        class: 'btn ghost', text: 'إزالة من الليستة (دون حذف الشيت)', onclick: () => {
          p.inList = false; savePatient(p); toast('أُزيلت من الليستة — الشيت محفوظ');
        }
      }));
    }
    card.appendChild(row2);
    return card;
  }

  window.OPH_SURGERY = { render: renderSurgery, markForReview };
})();
