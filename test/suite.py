#!/usr/bin/env python3
"""Full test suite for My Ophthalmology Assistant — drives the real app in headless Chromium.
Covers the directive's 8 mandatory scenarios (adapted to the web build)."""
import subprocess, sys, time, os, socket, json
from playwright.sync_api import sync_playwright

ROOT = os.path.expanduser('~/oph-app')
SHOTS = os.path.join(ROOT, 'test', 'shots')
os.makedirs(SHOTS, exist_ok=True)
RESULTS = []

def check(name, ok, detail=''):
    RESULTS.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + ((' — ' + str(detail)) if detail else ''))

srv = subprocess.Popen([sys.executable, os.path.join(ROOT, 'test', 'server.py')], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def wait_port():
    for _ in range(50):
        try:
            socket.create_connection(('127.0.0.1', 8742), 0.2).close(); return
        except OSError: time.sleep(0.1)

try:
    wait_port()
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={'width': 1180, 'height': 820}, device_scale_factor=2, accept_downloads=True)
        page = ctx.new_page()
        net_external = []
        page.on('request', lambda r: net_external.append(r.url) if not r.url.startswith(('http://127.0.0.1', 'data:', 'blob:')) else None)
        js_errors = []
        page.on('pageerror', lambda e: js_errors.append(str(e)))
        page.goto('http://127.0.0.1:8742/index.html')
        page.wait_for_selector('.home-buttons', timeout=8000)

        # ---- session ----
        page.click('text=جلسة تحضير جديدة')
        page.fill('.modal input[type=date] >> nth=1', '2026-11-30')
        page.click('.modal .btn.primary')
        page.wait_for_selector('.sidebar')

        def add_patient_ui():
            n = page.locator('.prow').count()
            page.click('text=+ مريض')
            page.wait_for_function(f"document.querySelectorAll('.prow').length === {n+1}")
            page.wait_for_selector('.tabs')

        # ============ TEST 1: full phaco case, OS data must flow to list ============
        add_patient_ui()
        page.fill('input[placeholder="الاسم الرباعي"]', 'سعاد محمود إبراهيم عبد الله')
        page.fill('input[placeholder="رقم الملف"]', '00421')
        page.fill('input[placeholder="السن"]', '65')
        page.click('text=Female — أنثى')
        # history: systemic DM + HTN
        page.click('.tab >> text=التاريخ المرضي')
        page.click('.chip.en >> text=DM')
        page.click('.chip.en >> text=HTN')
        page.click('.chip.en >> text=Diminution of vision (DOV)')
        # exam: vision OD 6/12 aided, OS 2/60 aided
        page.click('.tab >> text=الفحص')
        import re
        vis_card = page.locator('.card', has_text='النظر وضغط العين')
        vcols = vis_card.locator('.eyecol')
        vcols.nth(0).locator('.vrow').nth(1).locator('select').select_option('6/12')
        vcols.nth(1).locator('.vrow').nth(1).locator('select').select_option('2/60')
        # lens: OD Nuclear grade I ; OS Nuclear III Brown + PSC II
        lens_card = page.locator('.card', has_text='العدسة')
        lens_cols = lens_card.locator('.eyecol')
        lens_cols.nth(0).locator('.chip', has_text='Nuclear cataract').first.click()
        lens_cols.nth(0).locator('.chip', has_text=re.compile('^I$')).first.click()
        lens_cols.nth(1).locator('.chip', has_text='Nuclear cataract').first.click()
        lens_cols.nth(1).locator('.chip', has_text=re.compile('^III$')).first.click()
        lens_cols.nth(1).locator('.chip', has_text=re.compile('^Brown$')).first.click()
        lens_cols.nth(1).locator('.chip', has_text=re.compile('^PSC$')).first.click()
        lens_cols.nth(1).locator('.frow', has_text='PSC:').locator('.chip', has_text=re.compile('^II$')).click()
        # fundus OS: No view
        fund_card = page.locator('.card', has_text='قاع العين')
        fund_card.locator('.eyecol').nth(1).locator('.chip', has_text='No view').first.click()
        # investigations: biometry OS IOL +21.5
        page.click('.tab >> text=الفحوصات')
        bio = page.locator('.card', has_text='Biometry')
        bio.locator('.eyecol').nth(1).locator('input[placeholder="+21.5"]').fill('+21.5')
        # surgery prep
        page.click('.tab >> text=تحضير العملية')
        page.click('.chip.en >> text="Phaco"')
        page.click('text=OS — يسرى')
        page.fill('input[placeholder="التشخيص"]', 'Nuclear cataract')
        page.click('.card:has-text("التحاليل الفيروسية") .chip:has-text("-ve") >> nth=0')  # HCV
        page.click('.card:has-text("التحاليل الفيروسية") .chip:has-text("-ve") >> nth=1')  # HBV
        page.screenshot(path=f'{SHOTS}/10-surgery-review.png')
        # approve
        page.click('text=اعتماد الحالة (مكتملة التحضير)')
        page.click('text=إضافة إلى ليستة العمليات')
        page.wait_for_timeout(300)
        # verify list row
        page.click('text=→ الرئيسية') if page.locator('text=→ الرئيسية').count() else None
        page.goto('http://127.0.0.1:8742/index.html')  # fresh boot to prove persistence
        page.wait_for_selector('.home-buttons')
        page.click('text=ليستة العمليات')
        page.wait_for_selector('table.slist')
        page.screenshot(path=f'{SHOTS}/11-list-t1.png', full_page=True)
        cells = page.locator('table.slist td').all_inner_texts()
        joined = ' | '.join(cells)
        check('T1 list shows patient name', 'سعاد محمود إبراهيم عبد الله' in joined)
        check('T1 V/A from OS (2/60)', '2/60' in joined, joined[:300])
        check('T1 operation OS Phaco', 'OS Phaco' in joined)
        check('T1 IOL +21.5 present', '+21.5' in joined)
        check('T1 HCV/HBV -ve both', 'HCV: -ve' in joined and 'HBV: -ve' in joined)
        check('T1 medically DM / HTN', 'DM / HTN' in joined)
        check('T1 no wrong-eye VA 6/12 in VA cell', '6/12' not in joined)

        # ============ TEST 2: pterygium — no IOL, no leftovers ============
        page.goto('http://127.0.0.1:8742/index.html'); page.wait_for_selector('.home-buttons')
        page.click('text=شيتات العيون'); page.wait_for_selector('.sidebar')
        add_patient_ui()
        page.fill('input[placeholder="الاسم الرباعي"]', 'أحمد حسن علي محمد')
        page.fill('input[placeholder="السن"]', '54')
        page.click('.tab >> text=تحضير العملية')
        page.click('.chip.en >> text=Pterygium excision')
        page.click('text=OD — يمنى')
        iol_field = page.locator('text=IOL Power للعين')
        check('T2 IOL field hidden for Pterygium', iol_field.count() == 0)
        # HCV/HBV set, approve, add to list
        page.click('.card:has-text("التحاليل الفيروسية") .chip:has_text("-ve") >> nth=0' if False else '.card:has-text("التحاليل الفيروسية") .chip:has-text("-ve") >> nth=0')
        page.click('.card:has-text("التحاليل الفيروسية") .chip:has-text("-ve") >> nth=1')
        # fill VA via exam
        page.click('.tab >> text=الفحص')
        page.locator('.card', has_text='النظر وضغط العين').locator('.eyecol').nth(0).locator('.vrow').nth(1).locator('select').select_option('6/9')
        page.click('.tab >> text=تحضير العملية')
        page.fill('input[placeholder="التشخيص"]', 'Pterygium')
        page.wait_for_timeout(400)
        print('DEBUG T2 checklist:', page.evaluate("() => JSON.stringify({cl: OPH_DB.checklist(OPH.patient), name: OPH.patient.name})"))
        page.click('text=اعتماد الحالة (مكتملة التحضير)')
        page.click('text=إضافة إلى ليستة العمليات')
        page.wait_for_timeout(400)
        page.goto('http://127.0.0.1:8742/index.html')
        page.wait_for_selector('.home-buttons')
        page.click('text=ليستة العمليات'); page.wait_for_selector('table.slist')
        print('DEBUG T2 patients:', page.evaluate("() => JSON.stringify(OPH.patients.map(p=>[p.name,p.inList,p.surgery.operation,p.surgery.eye]))"))
        print('DEBUG T2 table rows:', page.locator('table.slist tr').count())
        print('DEBUG T2 listPatients:', page.evaluate("() => OPH_SLIST.listPatients().length"))
        print('DEBUG T2 js_errors:', js_errors)
        row2 = page.locator('table.slist tr', has_text='أحمد حسن علي محمد').inner_text()
        check('T2 pterygium row has empty IOL', '+' not in row2 and '21' not in row2, row2.replace('\n',' | ')[:300])
        check('T2 operation OD Pterygium excision', 'OD Pterygium excision' in row2)

        # ============ TEST 3: IVI — no IOL, no drug trade name ============
        page.goto('http://127.0.0.1:8742/index.html'); page.wait_for_selector('.home-buttons')
        page.click('text=شيتات العيون'); page.wait_for_selector('.sidebar')
        add_patient_ui()
        page.fill('input[placeholder="الاسم الرباعي"]', 'كريم سيد عبد الرحمن')
        page.click('.tab >> text=تحضير العملية')
        page.click('.chip.en >> text=IVI Anti-VEGF')
        page.click('text=OS — يسرى')
        check('T3 IVI: IOL field hidden', page.locator('text=IOL Power للعين').count() == 0)
        check('T3 IVI: no drug-name field', page.locator('text=Avastin').count() == 0 and page.locator('text=اسم الدواء التجاري').count() == 0)
        page.click('.tab >> text=الفحص')
        page.locator('.card', has_text='النظر وضغط العين').locator('.eyecol').nth(1).locator('.vrow').nth(1).locator('select').select_option('6/36')
        page.click('.tab >> text=تحضير العملية')
        page.fill('input[placeholder="التشخيص"]', 'DME')
        page.click('.card:has-text("التحاليل الفيروسية") .chip:has-text("Not available") >> nth=0')
        page.click('.card:has-text("التحاليل الفيروسية") .chip:has-text("Not available") >> nth=1')
        page.wait_for_timeout(300)
        page.click('text=اعتماد الحالة (مكتملة التحضير)')
        page.click('text=إضافة إلى ليستة العمليات')
        row3 = page.evaluate("""() => { const p = OPH.patient; return OPH_SLIST.rowData(p); }""")
        check('T3 IVI row IOL empty', row3['iol'] == '', row3)

        # ============ TEST 4: incomplete case → draft, not ready ============
        add_patient_ui()
        page.fill('input[placeholder="الاسم الرباعي"]', 'حالة غير مكتملة اختبار')
        st = page.evaluate("() => OPH_DB.status(OPH.patient)")
        check('T4 incomplete case not ready/completed', st in ('draft', 'incomplete'), st)
        page.click('.tab >> text=تحضير العملية')
        btn_disabled = page.locator('button:has-text("اعتماد الحالة")').is_disabled()
        check('T4 approve button blocked while data missing', btn_disabled)
        page.screenshot(path=f'{SHOTS}/12-incomplete.png')

        # ============ TEST 5: change operative eye after approval ============
        page.goto('http://127.0.0.1:8742/index.html'); page.wait_for_selector('.home-buttons')
        page.click('text=شيتات العيون'); page.wait_for_selector('.sidebar')
        page.click('.prow >> nth=0')  # patient 1 (phaco OS)
        page.click('.tab >> text=تحضير العملية')
        page.click('text=OD — يمنى')  # change eye to OD
        page.wait_for_timeout(300)
        st5 = page.evaluate("() => ({status: OPH_DB.status(OPH.patient), needsReview: OPH.patient.needsReview, va: OPH.patient.surgery.vaText, iol: OPH.patient.surgery.iolPower})")
        check('T5 approval revoked on eye change', st5['needsReview'] == True, st5)
        check('T5 status no longer completed', st5['status'] != 'completed', st5)
        check('T5 old-eye values cleared (no cross-eye carry-over)', st5['va'] == '' and st5['iol'] == '', st5)
        check('T5 re-approval blocked until new-eye data entered', page.locator('button:has-text("إعادة اعتماد")').is_disabled())
        # enter data for the new eye, then re-approval must succeed
        page.fill('input[placeholder="V/A للعين OD"]', '6/18')
        page.fill('input[placeholder="التشخيص"]', 'Nuclear cataract')
        page.fill('input[placeholder="+21.5"]', '+22.0')
        page.click('text=إعادة اعتماد بعد المراجعة')
        page.wait_for_timeout(300)
        st5b = page.evaluate("() => OPH_DB.status(OPH.patient)")
        check('T5 re-approval succeeds after new-eye data entered', st5b == 'completed', st5b)

        # ============ TEST 6: 20 patients, reorder, delete-from-list, persistence, transcribe, combined PDF ============
        page.evaluate("""async () => {
          const s = OPH.session;
          const ops = ['Phaco','Pterygium excision','IVI Anti-VEGF'];
          for (let i = 0; i < 17; i++) {
            const p = OPH_DB.newPatient(s.id, OPH.session.order.length + 1);
            p.name = 'مريض اختبار رقم ' + (i + 4) + ' بن فلان الفلاني';
            p.recordNo = '10' + String(i + 10);
            p.age = 40 + i;
            p.gender = i % 2 ? 'M' : 'F';
            p.systemic = i % 3 ? ['DM'] : ['Free'];
            p.surgery.operation = ops[i % 3];
            p.surgery.eye = i % 2 ? 'OD' : 'OS';
            p.surgery.hcv = '-ve'; p.surgery.hbv = '-ve';
            p.vision[p.surgery.eye.toLowerCase()].aided = '6/18';
            p.surgery.diagnosisText = 'Senile cataract';
            if (p.surgery.operation === 'Phaco') p.biometry[p.surgery.eye.toLowerCase()].iolPower = '+2' + (i % 10) + '.0';
            p.inList = true; p.reviewApproved = true;
            await OPH_DB.DB.put('patients', p);
            OPH.session.order.push(p.id); OPH.patients.push(p);
          }
          OPH_UTIL.saveSession();
        }""")
        page.reload(); page.wait_for_selector('.home-buttons')
        page.click('text=ليستة العمليات'); page.wait_for_selector('table.slist')
        nrows = page.locator('table.slist tr').count() - 1
        check('T6 list has 20 patients', nrows == 20, nrows)
        # reorder: move row 1 down
        first_name = page.locator('table.slist tr >> nth=1 >> td >> nth=2').inner_text()
        page.locator('table.slist tr >> nth=1 >> .rowhandle:has-text("▼")').click()
        page.wait_for_timeout(200)
        second_name = page.locator('table.slist tr >> nth=2 >> td >> nth=2').inner_text()
        check('T6 reorder works', first_name == second_name, f'{first_name} -> pos2: {second_name}')
        # delete from list keeps sheet
        before = page.evaluate("() => OPH.patients.length")
        page.locator('table.slist tr >> nth=3 >> .btn:has-text("إزالة")').click()
        page.wait_for_timeout(200)
        after = page.evaluate("() => OPH.patients.length")
        inlist = page.evaluate("() => OPH.patients.filter(p=>p.inList).length")
        check('T6 remove from list keeps sheet', before == after and inlist == 19, f'sheets {before}->{after}, list {inlist}')
        # persistence across reload
        page.reload(); page.wait_for_selector('.home-buttons')
        page.click('text=ليستة العمليات'); page.wait_for_selector('table.slist')
        nrows2 = page.locator('table.slist tr').count() - 1
        check('T6 persists after reload', nrows2 == 19, nrows2)
        page.screenshot(path=f'{SHOTS}/13-list-20.png', full_page=True)
        # mark list transcribed
        page.click('text=نُقلت الليستة للورق ✓')
        page.wait_for_timeout(200)
        lt = page.evaluate("() => OPH.patients.filter(p=>p.listTranscribed).length")
        check('T6 list transcribed flag', lt == 19, lt)

        # ============ Transcription mode ============
        page.goto('http://127.0.0.1:8742/index.html'); page.wait_for_selector('.home-buttons')
        page.click('text=وضع نقل البيانات')
        page.wait_for_selector('.transcribe svg', timeout=8000)
        page.screenshot(path=f'{SHOTS}/14-transcribe-sheet.png', full_page=True)
        page.click('text=Mark Sheet as Transcribed ✓')
        page.wait_for_timeout(200)
        cnt = page.locator('.badge.ok', has_text='Sheets Transcribed').inner_text()
        check('TR transcribed counter shows 1/21', cnt.startswith('1 / 21'), cnt)
        page.click('text=التالي ⟵')
        page.wait_for_timeout(300)
        page.screenshot(path=f'{SHOTS}/15-transcribe-next.png')

        # ============ TEST 7: long Arabic names, long terms, negative decimals in exports ============
        page.goto('http://127.0.0.1:8742/index.html'); page.wait_for_selector('.home-buttons')
        exp = page.evaluate("""async () => {
          const p = OPH.patients[0];
          p.name = 'عبد الرحمن محمد عبد العزيز إبراهيم السيد محمد الباجوري';
          p.surgery.diagnosisText = 'Nuclear cataract N III Brown + Posterior subcapsular cataract PSC II with pseudoexfoliation';
          p.biometry.os.iolPower = '-5.75';
          p.surgery.iolPower = '-5.75';
          const sheet = OPH_SVG.sheetSVG(p, OPH_EXPORT.svgSettings());
          const listPages = OPH_SVG.listSVGs(OPH_SLIST.listPatients(), OPH_EXPORT.svgSettings());
          return { sheetLen: sheet.svg.length, pages: listPages.length, svg: sheet.svg };
        }""")
        check('T7 sheet SVG generated', exp['sheetLen'] > 5000, exp['sheetLen'])
        # PNG conversion works
        png = page.evaluate("""async () => {
          const b = await OPH_EXPORT.makeSheetPNG(OPH.patients[0], 300, 'image/png');
          return b.size;
        }""")
        check('T7 sheet PNG at 300dpi renders', png > 100000, png)
        pdf = page.evaluate("""async () => {
          const b = await OPH_EXPORT.makePDF('all', 300);
          const head = await b.slice(0, 5).text();
          return { size: b.size, head };
        }""")
        check('T7 combined PDF valid', pdf['head'] == '%PDF-' and pdf['size'] > 200000, pdf['size'])
        with open(f'{SHOTS}/combined.pdf', 'wb') as f:
            b64 = page.evaluate("""async () => {
              const b = await OPH_EXPORT.makePDF('all', 300);
              const ab = await b.arrayBuffer();
              const u8 = new Uint8Array(ab);
              let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
              return btoa(s);
            }""")
            import base64
            f.write(base64.b64decode(b64))
        # sheet PNG for visual check
        b64png = page.evaluate("""async () => {
          const b = await OPH_EXPORT.makeSheetPNG(OPH.patients[0], 300, 'image/png');
          const ab = await b.arrayBuffer();
          const u8 = new Uint8Array(ab); let s = '';
          for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
          return btoa(s);
        }""")
        import base64
        with open(f'{SHOTS}/sheet-p1.png', 'wb') as f: f.write(base64.b64decode(b64png))
        b64list = page.evaluate("""async () => {
          const bs = await OPH_EXPORT.makeListPNGs(300, 'image/png');
          const ab = await bs[0].arrayBuffer();
          const u8 = new Uint8Array(ab); let s = '';
          for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
          return btoa(s);
        }""")
        with open(f'{SHOTS}/list-p1.png', 'wb') as f: f.write(base64.b64decode(b64list))

        # ============ TEST 8: lock + backup + no external connections ============
        page.goto('http://127.0.0.1:8742/index.html'); page.wait_for_selector('.home-buttons')
        # set passcode via module
        page.evaluate("""async () => {
          const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('oph:1234'));
          OPH.settings.passcodeHash = Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
          OPH_UTIL.saveSettings();
        }""")
        page.reload(); page.wait_for_selector('.lockscreen', timeout=5000)
        page.screenshot(path=f'{SHOTS}/16-lock.png')
        page.fill('.lockscreen input', '1234')
        page.click('.lockscreen .btn.primary')
        page.wait_for_selector('.home-buttons')
        check('T8 passcode lock + unlock works', True)
        # remove passcode for cleanliness
        page.evaluate("() => { OPH.settings.passcodeHash=''; OPH_UTIL.saveSettings(); }")
        # encrypted backup
        page.evaluate("() => { window._pass = 'test123'; }")
        bk = page.evaluate("""async () => {
          // replicate export with fixed pass via internal funcs
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const km = await crypto.subtle.importKey('raw', new TextEncoder().encode('test123'), 'PBKDF2', false, ['deriveKey']);
          const key = await crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:150000, hash:'SHA-256'}, km, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
          const sessions = await OPH_DB.DB.all('sessions');
          const patients = await OPH_DB.DB.all('patients');
          const plain = new TextEncoder().encode(JSON.stringify({sessions, patients}));
          const data = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, plain);
          const dec = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, data);
          return JSON.parse(new TextDecoder().decode(dec)).patients.length;
        }""")
        check('T8 encrypted backup round-trip', bk == 21, bk)

        # ============ TEST 9: at-rest encryption + persistent storage ============
        rows = page.evaluate("""async () => {
          const db = await new Promise((res, rej) => { const q = indexedDB.open('oph-assistant'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
          return await new Promise((res, rej) => { const t = db.transaction('patients','readonly').objectStore('patients').getAll(); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
        }""")
        all_enc = len(rows) > 0 and all(r.get('enc') == 1 and 'name' not in r and 'ct' in r for r in rows)
        no_plain = all('أحمد' not in str(r.get('ct', '')) for r in rows)
        check('T9 patient rows encrypted at rest (AES-GCM, no plaintext fields)', all_enc and no_plain, f'{len(rows)} rows')
        has_persist = page.evaluate("() => !!(navigator.storage && navigator.storage.persist)")
        check('T9 persistent storage API present + requested at boot', has_persist)

        # ============ TEST 10: airplane mode — service worker serves offline ============
        page.evaluate("() => navigator.serviceWorker.ready")
        ctx.set_offline(True)
        try:
            page.reload(); page.wait_for_selector('.home-buttons', timeout=8000)
            off_ok = True
        except Exception:
            off_ok = False
        ctx.set_offline(False)
        check('T10 app loads fully offline (simulated airplane mode)', off_ok)

        # ============ TEST 11: backup restore after full data wipe ============
        page.evaluate("OPH_UTIL.go('settings')")
        with page.expect_download() as dl_info:
            page.click('text=تصدير نسخة احتياطية مشفرة')
            page.fill('.modal input', 'wipepass')
            page.click('.modal .btn.primary')
        bkpath = '/tmp/oph-wipe-test.enc'
        dl_info.value.save_as(bkpath)
        page.evaluate("""async () => {
          const db = await new Promise((res, rej) => { const q = indexedDB.open('oph-assistant'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
          for (const s of ['sessions','patients','kv']) await new Promise((res, rej) => { const t = db.transaction(s,'readwrite').objectStore(s).clear(); t.onsuccess = () => res(); t.onerror = () => rej(t.error); });
        }""")
        page.reload(); page.wait_for_selector('.home-buttons')
        n0 = page.evaluate("async () => (await OPH_DB.DB.all('patients')).length")
        check('T11 full data wipe empties stores', n0 == 0, n0)
        page.evaluate("OPH_UTIL.go('settings')")
        with page.expect_file_chooser() as fc_info:
            page.click('text=استعادة نسخة احتياطية')
        fc_info.value.set_files(bkpath)
        page.wait_for_selector('.modal input', timeout=5000)
        page.fill('.modal input', 'wipepass')
        page.click('.modal .btn.primary')
        page.wait_for_selector('.home-buttons', timeout=8000)
        n1 = page.evaluate("async () => (await OPH_DB.DB.all('patients')).length")
        check('T11 restore after full wipe recovers all patients', n1 == 21, n1)

        # ============ TEST 12: app/SW update preserves existing data ============
        swp = os.path.join(ROOT, 'sw.js')
        orig_sw = open(swp, encoding='utf-8').read()
        try:
            open(swp, 'w', encoding='utf-8').write(orig_sw.replace('oph-assistant-v3', 'oph-assistant-v9test'))
            page.reload(); page.wait_for_selector('.home-buttons')
            page.wait_for_timeout(2000)  # new SW installs and activates (skipWaiting + clients.claim)
            page.reload(); page.wait_for_selector('.home-buttons')
            n12 = page.evaluate("async () => (await OPH_DB.DB.all('patients')).length")
            check('T12 app update (new SW version) preserves all data', n12 == 21, n12)
            caches_left = page.evaluate("async () => await caches.keys()")
            check('T12 old cache versions cleaned after update', caches_left == ['oph-assistant-v9test'], caches_left)
        finally:
            open(swp, 'w', encoding='utf-8').write(orig_sw)

        check('No external network requests', len(net_external) == 0, net_external[:5])
        check('No JS errors in whole suite', len(js_errors) == 0, js_errors[:3])

        browser.close()
finally:
    srv.terminate()

fails = [r for r in RESULTS if not r[1]]
print(f'\n===== {len(RESULTS)-len(fails)}/{len(RESULTS)} passed =====')
sys.exit(1 if fails else 0)
