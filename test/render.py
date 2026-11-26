#!/usr/bin/env python3
"""Regenerate export images with rich demo data for visual verification."""
import subprocess, sys, time, os, socket, base64
from playwright.sync_api import sync_playwright
ROOT = os.path.expanduser('~/oph-app')
SHOTS = os.path.join(ROOT, 'test', 'shots')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8750', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.5)
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(); page = b.new_page(viewport={'width':1180,'height':820})
        page.on('pageerror', lambda e: print('JSERR', e))
        page.goto('http://127.0.0.1:8750/index.html'); page.wait_for_selector('.home-buttons')
        page.evaluate("""async () => {
          const s = OPH_DB.newSession('2026-11-26', '2026-11-30', 'عمليات الأحد');
          await OPH_DB.DB.put('sessions', s);
          const mk = (name, rec, age, op, eye, iol) => {
            const p = OPH_DB.newPatient(s.id, 0);
            p.name = name; p.recordNo = rec; p.age = age; p.gender = 'M';
            p.systemic = ['DM','HTN'];
            p.complaint.items = ['Diminution of vision (DOV)']; p.complaint.eye='OU'; p.complaint.duration='1 year';
            p.pastHistory = [{item:'Phaco', eye:'OS', date:'2024-03', details:''}];
            p.vision.od.unaided='6/60'; p.vision.od.aided='6/12'; p.vision.os.unaided='1/60'; p.vision.os.aided='2/60';
            p.iop.od.value='14'; p.iop.od.method='GAT'; p.iop.os.value='16'; p.iop.os.method='GAT';
            p.exam.od.lens.findings = [{label:'Nuclear cataract', grade:'I'}];
            p.exam.od.lens.composed = 'N I';
            p.exam.os.lens.findings = [{label:'Nuclear cataract', grade:'III', brown:true},{label:'PSC', grade:'II'}];
            p.exam.os.lens.composed = 'N III Brown + PSC II';
            p.exam.os.fundus.findings = ['No view'];
            p.exam.od.cornea.findings = ['Clear']; p.exam.os.cornea.findings = ['Clear'];
            p.diagnoses.os = ['Nuclear cataract'];
            p.investigations.requested = [{item:'Biometry', result:''},{item:'CBC', result:''}];
            p.investigations.results = [{item:'Biometry', result:'AL 23.4 / K1 44.1 / K2 44.9'}];
            p.treatment.recommended = [{drug:'Moxifloxacin eye drops', eye:'OS', freq:'QID', duration:'1 week'}];
            p.biometry.os = {al:'23.4', k1:'44.1', k2:'44.9', acd:'3.1', iolPower:iol, targetRef:'-0.25', iolModel:'AcrySof IQ', notes:''};
            p.surgery = {operation:op, eye:eye, iolPower:iol, diagnosisText:'', vaText:'', notes:'', hcv:'-ve', hbv:'-ve'};
            p.inList = true; p.reviewApproved = true;
            return p;
          };
          const p1 = mk('محمد أحمد عبد العال السيد', '00761', 65, 'Phaco', 'OS', '+21.5');
          const p2 = mk('سعاد محمود إبراهيم عبد الله', '00421', 58, 'Pterygium excision', 'OD', '');
          const p3 = mk('كريم سيد عبد الرحمن علي', '10588', 71, 'IVI Anti-VEGF', 'OS', '');
          p3.systemic = ['Free'];
          for (const p of [p1,p2,p3]) { await OPH_DB.DB.put('patients', p); s.order.push(p.id); }
          await OPH_DB.DB.put('sessions', s);
          await OPH_UTIL.openSession(s.id, true);
        }""")
        page.wait_for_timeout(400)
        def dl(ev, path):
            b64 = page.evaluate(ev)
            open(path, 'wb').write(base64.b64decode(b64))
        dl("""async () => { const b = await OPH_EXPORT.makeSheetPNG(OPH.patients[0], 300, 'image/png');
            const u8 = new Uint8Array(await b.arrayBuffer()); let s=''; for (let i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return btoa(s); }""", f'{SHOTS}/sheet-demo.png')
        dl("""async () => { const bs = await OPH_EXPORT.makeListPNGs(300, 'image/png');
            const u8 = new Uint8Array(await bs[0].arrayBuffer()); let s=''; for (let i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return btoa(s); }""", f'{SHOTS}/list-demo.png')
        # transcribe view screenshot
        page.reload(); page.wait_for_selector('.home-buttons')
        page.click('text=وضع نقل البيانات'); page.wait_for_selector('.transcribe svg')
        page.screenshot(path=f'{SHOTS}/transcribe-demo.png', full_page=True)
        b.close()
finally:
    srv.terminate()
print('done')
