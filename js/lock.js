/* App lock: numeric passcode, auto-lock after inactivity, privacy cover on backgrounding. */
(function () {
  const { el, toast, saveSettings } = OPH_UTIL;

  let idleTimer = null, locked = false;

  async function hash(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('oph:' + s));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function init() {
    ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));
    document.addEventListener('visibilitychange', () => {
      const cover = document.getElementById('privacy-cover');
      if (cover) cover.style.display = document.hidden ? 'flex' : 'none';
      if (!document.hidden && OPH.settings.passcodeHash && OPH.settings.autoLockMinutes > 0) lockNow();
    });
    resetIdle();
    if (OPH.settings.passcodeHash) lockNow();
  }

  function resetIdle() {
    if (locked) return;
    clearTimeout(idleTimer);
    const m = OPH.settings ? OPH.settings.autoLockMinutes : 0;
    if (OPH.settings && OPH.settings.passcodeHash && m > 0) {
      idleTimer = setTimeout(lockNow, m * 60000);
    }
  }

  function lockNow() {
    if (!OPH.settings || !OPH.settings.passcodeHash) { toast('لم يُعيّن رمز قفل — عيّنه من الإعدادات'); return; }
    if (locked) return;
    locked = true;
    const scr = el('div', { class: 'lockscreen', id: 'lockscreen' });
    scr.appendChild(el('div', { style: 'font-size:1.4em;font-weight:700', text: '🔒 My Ophthalmology Assistant' }));
    const inp = el('input', { type: 'password', inputmode: 'numeric', maxlength: '8', placeholder: '••••' });
    scr.appendChild(inp);
    scr.appendChild(el('button', { class: 'btn primary', text: 'فتح', onclick: tryUnlock }));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
    document.body.appendChild(scr);
    inp.focus();
    async function tryUnlock() {
      if (await hash(inp.value) === OPH.settings.passcodeHash) {
        locked = false; scr.remove(); resetIdle();
      } else { inp.value = ''; toast('رمز غير صحيح'); }
    }
  }

  function setPasscode() {
    const bg = el('div', { class: 'modal-bg' });
    const i1 = el('input', { type: 'password', inputmode: 'numeric', maxlength: '8', placeholder: 'رمز جديد (4-8 أرقام)', style: 'width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);direction:ltr;margin-bottom:8px' });
    const i2 = el('input', { type: 'password', inputmode: 'numeric', maxlength: '8', placeholder: 'تأكيد الرمز', style: 'width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);direction:ltr' });
    const m = el('div', { class: 'modal' }, [el('h3', { text: 'تعيين رمز القفل' }), i1, i2, el('div', { class: 'actions' }, [
      el('button', {
        class: 'btn primary', text: 'حفظ', onclick: async () => {
          if (!/^\d{4,8}$/.test(i1.value)) { toast('الرمز 4-8 أرقام'); return; }
          if (i1.value !== i2.value) { toast('الرمزان غير متطابقين'); return; }
          OPH.settings.passcodeHash = await hash(i1.value); saveSettings(); bg.remove();
          toast('عُيّن رمز القفل'); OPH_UTIL.render();
        }
      }),
      el('button', { class: 'btn ghost', text: 'إلغاء', onclick: () => bg.remove() })
    ])]);
    bg.appendChild(m); document.body.appendChild(bg);
  }

  window.OPH_LOCK = { init, lockNow, setPasscode };
})();
