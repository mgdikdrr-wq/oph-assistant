/* Settings: doctor/hospital names, option lists, theme, export DPI, privacy, backup/restore. */
(function () {
  const { el, toast, confirmModal, saveSettings, applyTheme, go, render } = OPH_UTIL;

  function renderSettings(root) {
    root.appendChild(OPH_HOME.topbar('الإعدادات'));
    const wrap = el('div', { class: 'screen home' });
    const S = OPH.settings;

    // identity
    const idCard = el('div', { class: 'home-card' }, [el('h3', { text: 'الطبيب والمستشفى' })]);
    const dn = el('input', { type: 'text' }); dn.value = S.doctorName;
    dn.addEventListener('input', () => { S.doctorName = dn.value; saveSettings(); });
    const hn = el('input', { type: 'text' }); hn.value = S.hospitalName;
    hn.addEventListener('input', () => { S.hospitalName = hn.value; saveSettings(); });
    idCard.appendChild(OPH_BUILD.row([OPH_BUILD.field('اسم الطبيب', dn), OPH_BUILD.field('اسم المستشفى', hn)]));
    wrap.appendChild(idCard);

    // appearance
    const apCard = el('div', { class: 'home-card' }, [el('h3', { text: 'المظهر' })]);
    const fs = el('input', { type: 'range', min: '0.85', max: '1.4', step: '0.05' }); fs.value = String(S.fontScale || 1);
    fs.addEventListener('input', () => { S.fontScale = +fs.value; saveSettings(); applyTheme(); });
    const dm = el('button', { class: 'chip' + (S.darkMode ? ' on' : ''), text: '🌙 الوضع الليلي', onclick: () => { S.darkMode = !S.darkMode; saveSettings(); applyTheme(); render(); } });
    apCard.appendChild(OPH_BUILD.row([OPH_BUILD.field('حجم الخط', fs), OPH_BUILD.field('الألوان', el('div', { class: 'chips' }, [dm]))]));
    wrap.appendChild(apCard);

    // export
    const exCard = el('div', { class: 'home-card' }, [el('h3', { text: 'التصدير' })]);
    const dpi = el('select', { class: 'va' }); [300, 600].forEach(d => dpi.appendChild(el('option', { value: d, text: d + ' DPI' })));
    dpi.value = String(S.exportDpi || 300);
    dpi.addEventListener('change', () => { S.exportDpi = +dpi.value; saveSettings(); });
    exCard.appendChild(OPH_BUILD.row([OPH_BUILD.field('جودة الصور المصدرة', dpi)]));
    wrap.appendChild(exCard);

    // privacy / lock
    const prCard = el('div', { class: 'home-card' }, [el('h3', { text: 'الخصوصية والقفل' })]);
    const al = el('select', { class: 'va' });
    [[0, 'بدون قفل تلقائي'], [1, 'دقيقة'], [5, '5 دقائق'], [10, '10 دقائق'], [30, '30 دقيقة']].forEach(([v, l]) => al.appendChild(el('option', { value: v, text: l })));
    al.value = String(S.autoLockMinutes == null ? 5 : S.autoLockMinutes);
    al.addEventListener('change', () => { S.autoLockMinutes = +al.value; saveSettings(); });
    prCard.appendChild(OPH_BUILD.row([OPH_BUILD.field('القفل التلقائي بعد عدم الاستخدام', al)]));
    prCard.appendChild(OPH_BUILD.row([
      el('button', { class: 'btn small primary', text: S.passcodeHash ? 'تغيير رمز القفل' : 'تعيين رمز قفل', onclick: () => OPH_LOCK.setPasscode() }),
      S.passcodeHash ? el('button', { class: 'btn small danger', text: 'إزالة رمز القفل', onclick: () => confirmModal('إزالة رمز القفل', 'سيفتح التطبيق بدون رمز. متابعة؟', () => { S.passcodeHash = ''; saveSettings(); render(); }, 'إزالة') }) : null
    ]));
    prCard.appendChild(el('p', { style: 'color:var(--muted);font-size:.85em', text: 'ملاحظة: Face ID / Touch ID غير متاح لتطبيقات الويب — يستخدم التطبيق رمز قفل رقمي. البيانات لا تغادر الجهاز إطلاقًا.' }));
    wrap.appendChild(prCard);

    // option lists editor
    const optCard = el('div', { class: 'home-card' }, [el('h3', { text: 'القوائم الطبية والاختيارات الجاهزة' })]);
    const listSel = el('select', { class: 'va' });
    Object.keys(OPH_DATA.DEFAULT_OPTIONS).forEach(k => listSel.appendChild(el('option', { value: k, text: k })));
    const ta = el('textarea', { rows: 8, style: 'width:100%', class: 'en' });
    function fill() { ta.value = (OPH.options[listSel.value] || []).join('\n'); }
    listSel.addEventListener('change', fill); fill();
    optCard.appendChild(OPH_BUILD.row([OPH_BUILD.field('القائمة', listSel)]));
    optCard.appendChild(ta);
    optCard.appendChild(el('div', { class: 'frow' }, [
      el('button', { class: 'btn small primary', text: 'حفظ القائمة (سطر لكل اختيار)', onclick: () => {
        OPH.options[listSel.value] = ta.value.split('\n').map(x => x.trim()).filter(Boolean);
        saveSettings(); toast('حُفظت القائمة');
      } }),
      el('button', { class: 'btn small ghost', text: 'استعادة الافتراضي', onclick: () => {
        OPH.options[listSel.value] = OPH_DATA.DEFAULT_OPTIONS[listSel.value].slice(); saveSettings(); fill(); toast('استُعيدت القائمة الافتراضية');
      } })
    ]));
    wrap.appendChild(optCard);

    // favorite drugs
    const drCard = el('div', { class: 'home-card' }, [el('h3', { text: 'الأدوية المفضلة' })]);
    const dr = el('textarea', { rows: 4, style: 'width:100%', class: 'en' });
    dr.value = (S.favoriteDrugs || []).join('\n');
    drCard.appendChild(dr);
    drCard.appendChild(el('button', { class: 'btn small primary', text: 'حفظ', onclick: () => { S.favoriteDrugs = dr.value.split('\n').map(x => x.trim()).filter(Boolean); saveSettings(); toast('حُفظت الأدوية'); } }));
    wrap.appendChild(drCard);

    // backup / restore
    const bkCard = el('div', { class: 'home-card' }, [el('h3', { text: 'النسخ الاحتياطي والاستعادة' })]);
    bkCard.appendChild(el('div', { class: 'frow' }, [
      el('button', { class: 'btn primary', text: 'تصدير نسخة احتياطية مشفرة', onclick: OPH_BACKUP.exportBackup }),
      el('button', { class: 'btn', text: 'استعادة نسخة احتياطية', onclick: OPH_BACKUP.importBackup })
    ]));
    bkCard.appendChild(el('p', { style: 'color:var(--muted);font-size:.85em', text: 'النسخة مشفرة برمز تختاره (AES-256). احفظها في مكان آمن خارج الجهاز.' }));
    wrap.appendChild(bkCard);

    wrap.appendChild(el('button', { class: 'btn ghost', text: '→ الرئيسية', onclick: () => go('home') }));
    root.appendChild(wrap);
  }

  window.OPH_SETTINGS = { render: renderSettings };
})();

/* Encrypted backup (AES-GCM + PBKDF2) — everything stays on device. */
(function () {
  const { el, toast } = OPH_UTIL;

  async function dump() {
    const sessions = await OPH_DB.DB.all('sessions');
    const patients = await OPH_DB.DB.all('patients');
    return JSON.stringify({ v: 1, at: Date.now(), settings: OPH.settings, options: OPH.options, sessions, patients });
  }

  async function keyFrom(pass, salt) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  function askPass(title, cb) {
    const bg = el('div', { class: 'modal-bg' });
    const inp = el('input', { type: 'password', placeholder: 'رمز التشفير', style: 'width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);direction:ltr' });
    const m = el('div', { class: 'modal' }, [el('h3', { text: title }), inp, el('div', { class: 'actions' }, [
      el('button', { class: 'btn primary', text: 'تأكيد', onclick: () => { const v = inp.value; bg.remove(); if (v) cb(v); } }),
      el('button', { class: 'btn ghost', text: 'إلغاء', onclick: () => bg.remove() })
    ])]);
    bg.appendChild(m); document.body.appendChild(bg); inp.focus();
  }

  async function exportBackup() {
    askPass('اختر رمز تشفير للنسخة الاحتياطية', async pass => {
      try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await keyFrom(pass, salt);
        const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(await dump()));
        const blob = new Blob([salt, iv, new Uint8Array(data)], { type: 'application/octet-stream' });
        OPH_EXPORT.download(blob, 'oph-backup-' + new Date().toISOString().slice(0, 10) + '.enc');
        toast('صُدّرت النسخة المشفرة');
      } catch (e) { toast('فشل التصدير: ' + e.message); }
    });
  }

  function importBackup() {
    const fi = el('input', { type: 'file', accept: '.enc' });
    fi.addEventListener('change', () => {
      const f = fi.files[0]; if (!f) return;
      askPass('أدخل رمز تشفير النسخة', async pass => {
        try {
          const buf = new Uint8Array(await f.arrayBuffer());
          const salt = buf.slice(0, 16), iv = buf.slice(16, 28), data = buf.slice(28);
          const key = await keyFrom(pass, salt);
          const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
          const obj = JSON.parse(new TextDecoder().decode(plain));
          for (const s of obj.sessions || []) await OPH_DB.DB.put('sessions', s);
          for (const p of obj.patients || []) await OPH_DB.DB.put('patients', p);
          if (obj.settings) { OPH.settings = obj.settings; }
          if (obj.options) { OPH.options = obj.options; }
          OPH_UTIL.saveSettings();
          OPH.sessions = await OPH_DB.DB.all('sessions');
          OPH_UTIL.applyTheme(); OPH_UTIL.go('home');
          toast('استُعيدت النسخة بنجاح');
        } catch (e) { toast('فشلت الاستعادة — تحقق من الرمز والملف'); }
      });
    });
    fi.click();
  }

  window.OPH_BACKUP = { exportBackup, importBackup };
})();
