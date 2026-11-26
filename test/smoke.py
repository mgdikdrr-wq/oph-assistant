#!/usr/bin/env python3
"""Smoke test: boot the app in headless Chromium, create a session + patient, screenshot."""
import subprocess, sys, time, os, socket
from playwright.sync_api import sync_playwright

ROOT = os.path.expanduser('~/oph-app')
SHOTS = os.path.join(ROOT, 'test', 'shots')
os.makedirs(SHOTS, exist_ok=True)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8741', '--bind', '127.0.0.1'], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            socket.create_connection(('127.0.0.1', 8741), 0.2).close(); break
        except OSError: time.sleep(0.1)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={'width': 1180, 'height': 820}, device_scale_factor=2)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.goto('http://127.0.0.1:8741/index.html')
        page.wait_for_selector('.home-buttons', timeout=8000)
        page.screenshot(path=f'{SHOTS}/01-home.png')

        # create session
        page.click('text=جلسة تحضير جديدة')
        page.wait_for_selector('.modal')
        page.fill('.modal input[type=date] >> nth=1', '2026-11-30')
        page.fill('.modal input[type=text]', 'عمليات الأحد')
        page.click('.modal .btn.primary')
        page.wait_for_selector('.sidebar', timeout=5000)

        # add patient
        page.click('text=+ مريض')
        page.wait_for_selector('.tabs')
        page.screenshot(path=f'{SHOTS}/02-details.png')

        # fill details
        page.fill('input[placeholder="الاسم الرباعي"]', 'محمد أحمد عبد العال السيد')
        page.fill('input[placeholder="رقم الملف"]', '00761')
        page.fill('input[placeholder="السن"]', '65')
        page.click('text=Male — ذكر')
        page.click('text=First visit — أول زيارة')
        page.screenshot(path=f'{SHOTS}/03-details-filled.png')

        print('JS errors:', errors if errors else 'NONE')
        browser.close()
finally:
    srv.terminate()
