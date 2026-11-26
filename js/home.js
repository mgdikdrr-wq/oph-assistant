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
      ]),
      (() => {
        // prep progress bar (approved of total) + transcription progress
        const pct = c.total ? Math.round(c.completed / c.total * 100) : 0;
        const tpct = c.total ? Math.round(c.transcribed / c.total * 100) : 0;
        const frag = el('div', {});
        if (c.total) {
          frag.appendChild(el('div', { class: 'progress' }, [el('div', { class: 'fill', style: 'width:' + pct + '%' })]));
          frag.appendChild(el('div', { class: 'progress-label' }, [
            el('span', { text: 'إنجاز التحضير: ' + c.completed + ' / ' + c.total + ' (' + pct + '%)' }),
            el('span', { text: 'النقل للورق: ' + tpct + '%' })
          ]));
        }
        // operation distribution among listed cases
        const dist = {};
        OPH.patients.forEach(p => { if (p.inList && p.surgery.operation) dist[p.surgery.operation] = (dist[p.surgery.operation] || 0) + 1; });
        const keys = Object.keys(dist);
        if (keys.length) {
          frag.appendChild(el('div', { class: 'opdist' }, keys.map(k =>
            el('span', { class: 'badge done en', text: k + ': ' + dist[k] }))));
        }
        return frag;
      })()
    ]);

    const btns = el('div', { class: 'home-card' }, [
      el('div', { class: 'home-buttons' }, [
        el('button', { class: 'btn primary', onclick: newSessionModal }, [OPH_UI.icon('calendar'), 'جلسة تحضير جديدة']),
        el('button', { class: 'btn primary', onclick: async () => { const p = await addPatient(); if (!p) newSessionModal(); } }, [OPH_UI.icon('userplus'), 'إضافة مريض']),
        el('button', { class: 'btn accent', onclick: () => { OPH.tab = 'quick'; go('patients'); } }, [OPH_UI.icon('zap'), 'فحص سريع']),
        el('button', { class: 'btn', onclick: () => go('patients') }, [OPH_UI.icon('eye'), 'شيتات العيون']),
        el('button', { class: 'btn', onclick: () => go('list') }, [OPH_UI.icon('list'), 'ليستة العمليات']),
        el('button', { class: 'btn accent', onclick: () => go('transcribe') }, [OPH_UI.icon('clipboard'), 'وضع نقل البيانات']),
        el('button', { class: 'btn', onclick: () => go('export') }, [OPH_UI.icon('download'), 'تصدير']),
        el('button', { class: 'btn', onclick: () => go('sessions') }, [OPH_UI.icon('clock'), 'الجلسات السابقة']),
        el('button', { class: 'btn ghost', onclick: () => go('settings') }, [OPH_UI.icon('sliders'), 'الإعدادات'])
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
      el('button', { class: 'iconbtn', onclick: () => window.OPH_LOCK && OPH_LOCK.lockNow() }, [OPH_UI.icon('lock'), 'قفل'])
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
            const make = () => { bg.remove(); createSession(inPrep.value, inSurg.value, inTitle.value.trim()); };
            if (inSurg.value && inPrep.value && inSurg.value < inPrep.value) {
              confirmModal('تنبيه التواريخ', 'تاريخ العمليات (' + inSurg.value + ') قبل تاريخ التحضير (' + inPrep.value + '). مقصود لو كانت جلسة قديمة تُسجل بأثر رجعي — إنشاء على أي حال؟', make, 'إنشاء');
              return;
            }
            make();
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
