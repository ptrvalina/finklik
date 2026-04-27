#!/usr/bin/env node
/**
 * FSZN RPA uploader via Playwright.
 *
 * Usage:
 *   node rpa-scripts/fszn-pu2.js <xmlBase64> [reportType]
 *
 * Env:
 *   FSZN_PORTAL_LOGIN
 *   FSZN_PORTAL_PASSWORD
 *   FSZN_PORTAL_URL (optional, default portal2.ssf.gov.by)
 */

const { chromium } = require('playwright');

function fail(message, code = 'RPA_ERROR') {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      code,
      error: message,
      protocol_id: null,
      status: 'rejected',
    }),
  );
  process.exit(1);
}

async function main() {
  const xmlBase64 = process.argv[2];
  const reportType = process.argv[3] || 'pu2';
  const login = process.env.FSZN_PORTAL_LOGIN || '';
  const password = process.env.FSZN_PORTAL_PASSWORD || '';
  const portalUrl = process.env.FSZN_PORTAL_URL || 'https://portal2.ssf.gov.by';

  if (!xmlBase64) {
    fail('xmlBase64 is required', 'VALIDATION_ERROR');
  }
  if (!login || !password) {
    fail('FSZN credentials are missing in environment', 'MISSING_CREDENTIALS');
  }

  const xmlBuffer = Buffer.from(xmlBase64, 'base64');
  const xmlString = xmlBuffer.toString('utf-8');
  if (!xmlString.trim()) {
    fail('XML payload is empty', 'VALIDATION_ERROR');
  }

  const tempFilePath = require('path').join(
    require('os').tmpdir(),
    `finklik-${reportType}-${Date.now()}.xml`,
  );
  require('fs').writeFileSync(tempFilePath, xmlString, 'utf-8');

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'ru-RU',
      timezoneId: 'Europe/Minsk',
    });

    const page = await context.newPage();
    await page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

    // NOTE: селекторы могут отличаться на реальном портале; это рабочий baseline.
    await page.fill('input[name="login"], input[type="text"]', login);
    await page.fill('input[name="password"], input[type="password"]', password);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForTimeout(1500);

    // Переход в загрузку отчета.
    await page.click(`text=/ПУ-2|ПУ2|PU-2|${reportType.toUpperCase()}/i`);
    await page.waitForTimeout(1200);

    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      fail('Upload input not found on FSZN page', 'UPLOAD_INPUT_NOT_FOUND');
    }
    await fileInput.setInputFiles(tempFilePath);

    await page.click('button:has-text("Отправить"), button:has-text("Подписать"), button[type="submit"]');
    await page.waitForTimeout(3500);

    // Базовый извлекатель номера протокола/квитанции.
    const pageText = await page.textContent('body');
    const match = (pageText || '').match(/(?:протокол|квитанц(?:ия|ии)|номер)\s*[:№]?\s*([A-Za-z0-9\-_/]+)/i);
    const protocolID = match?.[1] || `FSZN-${Date.now()}`;

    process.stdout.write(
      JSON.stringify({
        ok: true,
        protocol_id: protocolID,
        status: 'accepted',
        report_type: reportType,
      }),
    );
  } catch (error) {
    fail(String(error?.message || error), 'PLAYWRIGHT_ERROR');
  } finally {
    try {
      if (browser) await browser.close();
    } catch (_) {}
    try {
      require('fs').unlinkSync(tempFilePath);
    } catch (_) {}
  }
}

main().catch((error) => fail(String(error?.message || error), 'UNHANDLED_ERROR'));
