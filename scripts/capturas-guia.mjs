// Capturas reales de Yapa para la guía visual.
// Uso: node scripts/capturas-guia.mjs  (requiere `npm run dev` en :5174)
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.APP_URL || 'http://localhost:5174'
const OUT = 'capturas-guia'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=2'],
})

const page = await browser.newPage()

// Sin splash de bienvenida y sin prompts de instalación PWA.
await page.evaluateOnNewDocument(() => {
  try {
    sessionStorage.setItem('yapa_splash_ok', '1')
  } catch { /* noop */ }
})

const shot = async (nombre) => {
  await new Promise((r) => setTimeout(r, 700))
  await page.screenshot({ path: `${OUT}/${nombre}.png` })
  console.log('  ✔', nombre)
}

const clickTexto = async (texto, sel = 'button') => {
  const ok = await page.evaluate(
    (t, s) => {
      const els = [...document.querySelectorAll(s)]
      const el = els.find((e) => e.textContent.trim().toLowerCase().includes(t))
      if (el) { el.click(); return true }
      return false
    },
    texto.toLowerCase(), sel
  )
  if (!ok) console.log('    ! no encontré botón:', texto)
  return ok
}

const nav = (key) => page.evaluate((k) => window.dispatchEvent(new CustomEvent('yapa:nav', { detail: k })), key)
const logout = async () => {
  await page.evaluate(() => localStorage.removeItem('kiosco_session_v2'))
  await page.reload({ waitUntil: "domcontentloaded" })
}
const demo = async (i) => {
  await page.waitForSelector('.demo-btn', { timeout: 15000 })
  const btns = await page.$$('.demo-btn')
  await btns[i].click()
  await new Promise((r) => setTimeout(r, 1400))
}

const MOBILE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
const DESKTOP = { width: 1280, height: 800, deviceScaleFactor: 1.5 }

/* ---------------- MÓVIL ---------------- */
await page.setViewport(MOBILE)
await page.goto(BASE, { waitUntil: "domcontentloaded" })
await new Promise((r) => setTimeout(r, 1200))
await shot('01-login')

// Catálogo público (visitante)
await clickTexto('catálogo') || await page.evaluate(() => window.dispatchEvent(new CustomEvent('yapa:catalog')))
await new Promise((r) => setTimeout(r, 1400))
await shot('02-catalogo')
// Detalle de producto con galería/stepper
await clickTexto('Gaseosa cola', 'button, .product-card, article')
await new Promise((r) => setTimeout(r, 900))
await shot('03-producto-detalle')
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 500))

/* ---- Cliente (demo) ---- */
// Volver a la vista de login vía el evento interno de la app.
await page.evaluate(() => window.dispatchEvent(new CustomEvent('yapa:login')))
await new Promise((r) => setTimeout(r, 1200))
await demo(0) // Demo Cliente
await shot('04-cliente-billetera')
await nav('carnet')
await shot('05-cliente-carnet-qr')
await nav('encargos')
await shot('06-cliente-encargos')
await nav('catalogo')
await shot('07-cliente-catalogo')

/* ---- Vendedor (demo) ---- */
await logout()
await demo(1)
await shot('08-pos')
// Armar un ticket de muestra
await clickTexto('Gaseosa cola', 'button')
await clickTexto('Alfajor', 'button')
await new Promise((r) => setTimeout(r, 500))
await shot('09-pos-ticket')
await nav('encargos')
await shot('10-encargos-panel')
await nav('cobranza')
await shot('11-cobranza')
await nav('stock')
await shot('12-stock-rapido')

/* ---- Admin (demo) ---- */
await logout()
await demo(2)
await nav('productos')
await shot('13-productos-abm')
// Modal nuevo producto con selector de emoji
await clickTexto('nuevo producto')
await new Promise((r) => setTimeout(r, 700))
await shot('14-producto-nuevo')
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === '__nueva__'))
  if (sel) {
    sel.value = '__nueva__'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }
})
await new Promise((r) => setTimeout(r, 600))
await shot('15-producto-emoji')
// Recargar para cerrar el modal (la sesión persiste en localStorage).
await page.reload({ waitUntil: "domcontentloaded" })
await new Promise((r) => setTimeout(r, 2000))
await nav('clientes')
await shot('16-clientes-libreta')
await nav('reportes')
await shot('17-reportes')
await nav('notifs')
await shot('18-notificaciones')
await nav('vencimientos')
await shot('19-vencimientos')
await nav('config')
await shot('20-config')

/* ---------------- ESCRITORIO ---------------- */
await page.setViewport(DESKTOP)
await nav('pos')
await shot('21-pos-desktop')
await nav('reportes')
await shot('22-reportes-desktop')
await nav('clientes')
await shot('23-clientes-desktop')

await browser.close()
console.log('\nCapturas listas en', OUT)
