/**
 * Export VTB presentation HTML to PDF — one page per slide.
 * Usage: node scripts/generate-presentation-pdf.mjs
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(__dirname, '../docs/presentations/product-presentation')
const HTML = path.join(DIR, 'index.html')
const OUT = path.join(DIR, 'FinKlik-VTB.pdf')

const fileUrl = 'file:///' + HTML.replace(/\\/g, '/')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })

await page.goto(fileUrl, { waitUntil: 'networkidle' })
await page.evaluate(() => document.body.classList.add('print-all'))
await page.emulateMedia({ media: 'screen' })

await page.pdf({
  path: OUT,
  width: '1280px',
  height: '720px',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  preferCSSPageSize: true,
})

await browser.close()
console.log('PDF:', OUT)
