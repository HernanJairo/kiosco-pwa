// Barrido visual escritorio 1280x900: cada vista de los 3 roles sin
// overflow horizontal, sin textos desbordados y sin errores JS/HTTP.
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5173'
const OUT = 'capturas-guia/qa-desktop'
fs.mkdirSync(OUT, { recursive: true })

let pasos = 0
let fallos = 0
const ok = (cond, nombre) => {
  pasos++
  if (cond) console.log(`  ✔ ${nombre}`)
  else {
    fallos++
    console.log(`  ✘ ${nombre}`)
  }
}
const pageErrors = []
const consoleErrors = []
const badResponses = []
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
page.on('pageerror', (e) => pageErrors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('response', (r) => {
  if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`)
})
await page.setViewport({ width: 1280, height: 900 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const waitPage = () => sleep(1400)

const esperaTexto = async (txt, timeout = 12000) => {
  const t0 = Date.now()
  const needle = txt.toLowerCase()
  while (Date.now() - t0 < timeout) {
    const found = await page.evaluate((n) => document.body.innerText.toLowerCase().includes(n), needle)
    if (found) return true
    await sleep(300)
  }
  return false
}
const clickTexto = async (txt) =>
  page.evaluate((n) => {
    const els = [...document.querySelectorAll('button, a, [role="button"], li')]
    const el = els.find((x) => x.innerText && x.innerText.trim().toLowerCase().includes(n))
    if (el) { el.click(); return true }
    return false
  }, txt)
const login = async (boton, espera) => {
  ok(await esperaTexto(boton, 20000), `login visible para "${boton}"`)
  ok(await clickTexto(boton), `click "${boton}"`)
  await waitPage()
  ok(await esperaTexto(espera, 15000), `sesión iniciada (${espera})`)
}
const salir = async () => { ok(await clickTexto('salir'), 'click Salir'); await waitPage() }
const anchoOK = () => page.evaluate(() => document.documentElement.scrollWidth <= 1281)
const textosDesbordados = (sels) =>
  page.evaluate((ss) => {
    const mal = []
    for (const sel of ss) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.scrollWidth > el.clientWidth + 1) mal.push(`${sel} → "${el.textContent.trim().slice(0, 30)}"`)
      }
    }
    return mal
  }, sels)
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })

console.log('=== QA ESCRITORIO 1280x900 ===\n')
await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(1200)

console.log('=== LOGIN ===')
await shot('d0-login')
ok(await anchoOK(), 'login sin overflow horizontal')

console.log('\n=== CLIENTE ===')
await login('demo cliente', '¿qué se te antoja?')
ok(await anchoOK(), 'catálogo sin overflow')
const dCat = await textosDesbordados(['.category-card', '.stock-pill', '.product-name'])
ok(dCat.length === 0, `catálogo: sin textos desbordados (${dCat.length})${dCat.length ? ' :: ' + dCat.slice(0, 3).join(' | ') : ''}`)
await shot('d1-catalogo')
ok(await clickTexto('mi billetera'), 'tab Mi Billetera')
ok(await esperaTexto('saldo disponible', 10000), 'billetera renderizó')
ok(await anchoOK(), 'billetera sin overflow')
await shot('d2-billetera')
ok(await clickTexto('mi carnet'), 'tab Mi Carnet')
ok(await esperaTexto('credencial digital', 10000), 'carnet renderizó')
ok(await clickTexto('ampliar y subir brillo'), 'abrió modal credencial')
await sleep(600)
ok(!!(await page.$('[role="dialog"][aria-label="Credencial ampliada"]')), 'modal credencial abierto')
await shot('d3-credencial-modal')
await clickTexto('cerrar')
await sleep(400)
ok(await clickTexto('historial'), 'tab Historial')
await sleep(800)
ok(await anchoOK(), 'historial sin overflow')
await shot('d4-historial')
await salir()

console.log('\n=== VENDEDOR ===')
await login('demo vendedor', 'terminal pos')
await sleep(800)
ok(await anchoOK(), 'POS sin overflow')
const dPos = await textosDesbordados(['.category-card', '.stock-pill', '.product-name'])
ok(dPos.length === 0, `POS: sin textos desbordados (${dPos.length})${dPos.length ? ' :: ' + dPos.slice(0, 3).join(' | ') : ''}`)
await shot('d5-pos')
for (const [tab, espera] of [
  ['cobranzas', 'buscar cliente'],
  ['encargos', 'pedidos por armar'],
  ['stock rápido', 'stock'],
  ['clientes', 'cliente'],
  ['ventas', 'ventas'],
  ['mi actividad', 'actividad'],
]) {
  ok(await clickTexto(tab), `tab "${tab}"`)
  ok(await esperaTexto(espera, 10000), `"${tab}" renderizó`)
  await sleep(500)
  ok(await anchoOK(), `"${tab}" sin overflow`)
  await shot(`d6-v-${tab.replace(/\s/g, '-')}`)
}
await salir()

console.log('\n=== ADMIN ===')
await login('demo admin', 'terminal pos')
await sleep(800)
for (const [tab, espera] of [
  ['productos', 'productos'],
  ['catálogo', '¿qué se te antoja?'],
  ['vencimientos', 'vencimient'],
  ['clientes', 'cliente'],
  ['ventas', 'ventas'],
  ['notificaciones', 'notificaciones'],
  ['reportes', 'reportes'],
  ['configuración', 'configuraci'],
]) {
  ok(await clickTexto(tab), `tab "${tab}"`)
  ok(await esperaTexto(espera, 10000), `"${tab}" renderizó`)
  await sleep(500)
  ok(await anchoOK(), `"${tab}" sin overflow`)
  await shot(`d7-a-${tab.replace(/\s/g, '-')}`)
}
// Desborde en reportes/inventario (chips y badges compactos)
const dRep = await textosDesbordados(['.analytics-view .period-pill', '.analytics-view .status-filter', '.analytics-view .management-tab', '.analytics-view .stock-badge'])
console.log(`  (desborde reportes: ${dRep.length})`)
await salir()

console.log('\n================= RESULTADO =================')
console.log(`Pasos ejecutados: ${pasos} · Fallos: ${fallos}`)
if (pageErrors.length) { console.log('\n❌ Excepciones JS:'); pageErrors.forEach((e) => console.log(`  • ${e}`)) }
else console.log('\n✅ Sin excepciones de JavaScript (pageerror).')
if (consoleErrors.length) { console.log('\n❌ Errores de consola:'); consoleErrors.slice(0, 20).forEach((e) => console.log(`  • ${e}`)) }
else console.log('✅ Sin errores de consola.')
if (badResponses.length) { console.log('\n❌ HTTP >= 400:'); badResponses.slice(0, 15).forEach((e) => console.log(`  • ${e}`)) }
else console.log('✅ Sin respuestas HTTP >= 400.')

await browser.close()
process.exit(fallos || pageErrors.length || consoleErrors.length ? 1 : 0)
