/* Home dashboard + session management screens. */
(function () {
  const { el, toast, confirmModal, go, createSession, deleteSession, openSession, addPatient, render } = OPH_UTIL;
  const { status } = OPH_DB;

  function fmtDate(d) { return d || '—'; }

  function counters() {
    const ps = OPH.patients;
    const c = { total: ps.length, completed: 0, incomplete: 0, transcribed: 0 };
    ps.forEach(p => {
      const s = status(p);
      if (s === 'completed') c.completed++; else c.incomplete++;
      if (p.sheetTranscribed) c.transcribed++;
    });
    return c;
  }

  function renderHome(root) {
    const s = OPH.session;
    const c = counters();
    const wrap = el('div', { class: 'screen home' });

    const head = el('div', { class: 'home-card' }, [
      el('div', { class: 'home-head' }, [
        el('h1', { text: OPH.settings.doctorName }),
        el('span', { class: 'hosp', text: OPH.settings.hospitalName })
      ]),
      el('div', { class: 'dates' }, s ? [
        el('span', { text: 'تاريخ التحضير: ' + fmtDate(s.prepDate) }),
        el('span', { text: 'تاريخ العمليات: ' + fmtDate(s.surgeryDate) }),
        s.title ? el('span', { text: s.title }) : null
      ] : [el('span', { text: 'لا توجد جلسة مفتوحة' })]),
      el('div', { class: 'counters' }, [
        counter(c.total, 'الحالات المسجلة', ''),
        counter(c.completed, 'مكتملة التحضير', 'ok'),
        counter(c.incomplete, 'غير مكتملة', 'bad'),
        counter(c.transcribed, 'نُقلت للورق', 'done')
      ])
    ]);

    const btns = el('div', { class: 'home-card' }, [
      el('div', { class: 'home-buttons' }, [
        el('button', { class: 'btn primary', text: 'جلسة تحضير جديدة', onclick: newSessionModal }),
        el('button', { class: 'btn primary', text: 'إضافة مريض', onclick: async () => { const p = await addPatient(); if (!p) newSessionModal(); } }),
        el('button', { class: 'btn', text: 'شيتات العيون', onclick: () => go('patients') }),
        el('button', { class: 'btn', text: 'ليستة العمليات', onclick: () => go('list') }),
        el('button', { class: 'btn accent', text: 'وضع نقل البيانات', onclick: () => go('transcribe') }),
        el('button', { class: 'btn', text: 'تصدير', onclick: () => go('export') }),
        el('button', { class: 'btn', text: 'الجلسات السابقة', onclick: () => go('sessions') }),
        el('button', { class: 'btn ghost', text: 'الإعدادات', onclick: () => go('settings') })
      ])
    ]);

    wrap.appendChild(head); wrap.appendChild(btns);
    root.appendChild(topbar('My Ophthalmology Assistant'));
    root.appendChild(wrap);
  }

  function counter(n, label, cls) {
    return el('div', { class: 'counter ' + cls }, [
      el('div', { class: 'n', text: String(n) }),
      el('div', { text: label })
    ]);
  }

  function topbar(title) {
    return el('div', { class: 'topbar' }, [
      el('span', { class: 'title', text: title }),
      el('span', { class: 'spacer' }),
      el('button', { class: 'iconbtn', text: '🔒 قفل', onclick: () => window.OPH_LOCK && OPH_LOCK.lockNow() })
    ]);
  }

  function newSessionModal() {
    const today = OPH_DB.todayStr();
    const bg = el('div', { class: 'modal-bg' });
    const inPrep = el('input', { type: 'date', value: today });
    const inSurg = el('input', { type: 'date' });
    const inTitle = el('input', { type: 'text', placeholder: 'عنوان اختياري (مثال: عمليات الأحد)' });
    const m = el('div', { class: 'modal' }, [
      el('h3', { text: 'جلسة تحضير جديدة' }),
      el('div', { class: 'frow' }, [field('تاريخ التحضير', inPrep), field('تاريخ العمليات', inSurg)]),
      el('div', { class: 'frow' }, [field('العنوان', inTitle)]),
      el('div', { class: 'actions' }, [
        el('button', {
          class: 'btn primary', text: 'إنشاء', onclick: () => {
            bg.remove();
            createSession(inPrep.value, inSurg.value, inTitle.value.trim());
          }
        }),
        el('button', { class: 'btn ghost', text: 'إلغاء', onclick: () => bg.remove() })
      ])
    ]);
    bg.appendChild(m); document.body.appendChild(bg);
  }

  function field(label, input) {
    return el('div', { class: 'field' }, [el('label', { text: label }), input]);
  }

  function renderSessions(root) {
    root.appendChild(topbar('الجلسات السابقة'));
    const wrap = el('div', { class: 'screen home' });
    const back = el('button', { class: 'btn ghost small', text: '→ الرئيسية', onclick: () => go('home') });
    wrap.appendChild(el('div', { style: 'margin-bottom:10px' }, [back]));
    if (!OPH.sessions.length) wrap.appendChild(el('div', { class: 'home-card', text: 'لا توجد جلسات محفوظة.' }));
    OPH.sessions.forEach(s => {
      const isCur = OPH.session && OPH.session.id === s.id;
      const card = el('div', { class: 'home-card' }, [
        el('div', { class: 'home-head' }, [
          el('h1', { style: 'font-size:1.1em', text: s.title || ('جلسة ' + s.prepDate) }),
          isCur ? el('span', { class: 'badge ok', text: 'مفتوحة الآن' }) : null
        ]),
        el('div', { class: 'dates' }, [
          el('span', { text: 'التحضير: ' + fmtDate(s.prepDate) }),
          el('span', { text: 'العمليات: ' + fmtDate(s.surgeryDate) }),
          el('span', { text: 'عدد الحالات: ' + (s.order ? s.order.length : 0) })
        ]),
        el('div', { class: 'actions', style: 'margin-top:10px;display:flex;gap:8px' }, [
          el('button', { class: 'btn primary small', text: 'فتح / استكمال', onclick: async () => { await openSession(s.id, true); go('patients'); } }),
          el('button', {
            class: 'btn danger small', text: 'حذف', onclick: () =>
              confirmModal('حذف الجلسة', 'سيتم حذف الجلسة وكل شيتات مرضاها نهائيًا. هل أنت متأكد؟', async () => { await deleteSession(s.id); render(); }, 'حذف نهائي')
          })
        ])
      ]);
      wrap.appendChild(card);
    });
    root.appendChild(wrap);
  }

  window.OPH_HOME = { render: renderHome, renderSessions, newSessionModal, topbar, counters };
})();
