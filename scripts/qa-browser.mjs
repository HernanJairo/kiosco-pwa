// QA E2E en navegador real (Chrome + puppeteer-core) sobre el dev server.
// Recorre los flujos de cliente (2 encargos: titular y tercero), mostrador
// (vendedor) y admin; captura excepciones JS, errores de consola y
// respuestas HTTP >= 400 (incluido Firestore).
//
// Correr con `npm run dev` en :5173:  node scripts/qa-browser.mjs
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.APP_URL || 'http://localhost:5173'
const OUT = 'capturas-guia/qa'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

mkdirSync(OUT, { recursive: true })

const pageErrors = []
const consoleErrors = []
const badResponses = []
const failedRequests = []

let pasos = 0
let fallos = 0
const ok = (cond, nombre) => {
  pasos++
  if (cond) console.log(`  ✔ ${nombre}`)
  else { fallos++; console.log(`  ✘ ${nombre}`) }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 900 })

page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('response', (r) => {
  if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`)
})
page.on('requestfailed', (r) => {
  const err = r.failure()?.errorText || ''
  // Firestore WebChannel aborta long-polls al cambiar de vista: ruido conocido.
  if (!err.includes('ERR_ABORTED') || !r.url().includes('googleapis')) {
    failedRequests.push(`${err} ${r.url()}`)
  }
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = async (nombre) => {
  await sleep(500)
  await page.screenshot({ path: `${OUT}/${nombre}.png` })
  console.log(`  📷 ${nombre}`)
}
const hayTexto = (t) =>
  page.evaluate((x) => document.body.innerText.toLowerCase().includes(x), t.toLowerCase())
const esperaTexto = async (t, timeout = 15000) => {
  const fin = Date.now() + timeout
  while (Date.now() < fin) {
    if (await hayTexto(t)) return true
    await sleep(250)
  }
  return false
}
const clickTexto = async (t, sel = 'button') =>
  page.evaluate(
    (x, s) => {
      const els = [...document.querySelectorAll(s)]
      const el = els.find((e) => e.textContent.trim().toLowerCase().includes(x) && !e.disabled)
      if (el) { el.click(); return true }
      return false
    },
    t.toLowerCase(),
    sel
  )
const clickIdx = (sel, i) =>
  page.evaluate((s, n) => { const els = [...document.querySelectorAll(s)]; els[n]?.click(); return !!els[n] }, sel, i)
const tipear = (sel, idx, valor) =>
  page.evaluate(
    (s, n, v) => {
      const el = [...document.querySelectorAll(s)][n]
      if (!el) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    sel,
    idx,
    valor
  )

const login = async (demoTexto, espera) => {
  ok(await esperaTexto('Demo Cliente'), `login visible para "${demoTexto}"`)
  ok(await clickTexto(demoTexto, '.demo-btn'), `click "${demoTexto}"`)
  ok(await esperaTexto(espera, 20000), `sesión iniciada (${espera})`)
}
const logout = async () => {
  ok(await clickTexto('salir'), 'click Salir')
  await esperaTexto('Demo Cliente', 12000)
}
const irTab = async (nombre, chequeo) => {
  ok(await clickTexto(nombre, 'nav button'), `tab "${nombre}"`)
  await sleep(900)
  if (chequeo) ok(await esperaTexto(chequeo, 8000), `"${nombre}" renderizó (${chequeo})`)
}

console.log('\n=== 1) LOGIN PÚBLICO + REDISEÑO DEL HEADER ===')
await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 })
await esperaTexto('Demo Cliente', 25000)
await shot('01-login-redisenio')
ok(await hayTexto('yapa'), 'marca Yapa visible')
ok(!(await page.evaluate(() => !!document.querySelector('.mosaic-topline'))), 'eslogan ya NO está superpuesto a la ilustración')
ok(await page.evaluate(() => !!document.querySelector('.panel-brand')), 'marca Yapa protagonista en el panel')

console.log('\n=== 2) CLIENTE: ENCARGO "RETIRO YO" ===')
await login('demo cliente', '¿Qué se te antoja?')
await sleep(600)
ok(await clickIdx('.add-button', 0), 'agregar producto 1 al pedido')
await sleep(300)
ok(await clickIdx('.add-button', 1), 'agregar producto 2 al pedido')
await sleep(400)
ok(await clickIdx('.cart-floating', 0), 'abrir "Ver mi pedido"')
await sleep(500)
ok(await clickIdx('.pickup-button', 0), 'abrir "Retirar pedido en local"')
await sleep(400)
ok(await clickIdx('.pickup-choice', 0), 'elegir "Retiro yo"')
await sleep(300)
ok(await clickTexto('confirmar encargo'), 'click "Confirmar encargo"')
ok(await esperaTexto('pedido listo', 20000), 'encargo titular confirmado (sin "config is not defined")')
await shot('02-encargo-titular-ok')
ok(await clickTexto('volver al catálogo'), 'cerrar confirmación')
await sleep(500)

console.log('\n=== 3) CLIENTE: ENCARGO "RETIRA OTRA PERSONA" ===')
ok(await clickIdx('.add-button', 2), 'agregar producto al pedido')
await sleep(400)
ok(await clickIdx('.cart-floating', 0), 'abrir "Ver mi pedido"')
await sleep(500)
ok(await clickIdx('.pickup-button', 0), 'abrir "Retirar pedido en local"')
await sleep(400)
ok(await clickIdx('.pickup-choice', 1), 'elegir "Retira otra persona"')
await sleep(300)
ok(await tipear('.authorized-fields input', 0, 'Tercero QA'), 'nombre del autorizado')
ok(await tipear('.authorized-fields input', 1, '99888777'), 'DNI del autorizado')
await sleep(300)
ok(await clickTexto('confirmar encargo'), 'click "Confirmar encargo"')
ok(await esperaTexto('pedido listo', 20000), 'encargo tercero confirmado')
await shot('03-encargo-tercero-ok')
ok(await clickTexto('volver al catálogo'), 'cerrar confirmación')
await sleep(500)

console.log('\n=== 4) CLIENTE: RESTO DE TABS ===')
await irTab('mis encargos', 'tus encargos')
ok(await esperaTexto('activo', 8000), 'encargos activos visibles para el cliente')
ok(await esperaTexto('retira: tercero qa', 8000), 'tercero autorizado persistido en el encargo')
await shot('04-mis-encargos')
await irTab('mi billetera', 'billetera')
await irTab('mi carnet', 'carnet')
await irTab('historial', 'historial')
await irTab('soporte', 'soporte')
await logout()

console.log('\n=== 5) VENDEDOR: COLA DE ENCARGOS + COBRO EN CAJA ===')
await login('demo vendedor', 'escanear')
await irTab('encargos', 'pedidos por armar')
await shot('05-encargos-mostrador')

// Procesa la cola completa: marcar listo → cobrar en caja → confirmar
// cobro en el POS → encargo entregado. Cubre tanto "Retiro yo" como
// "Retira otra persona" (y cualquier pendiente anterior). El loop va por
// ID de pedido para no re-clickear una tarjeta recién entregada que aún
// no desapareció del DOM.
let procesados = 0
const vistos = new Set()
const primerPedidoCola = () =>
  page.evaluate(() => {
    for (const li of document.querySelectorAll('li')) {
      const m = li.textContent.match(/Pedido\s+#([0-9A-F]{8})/i)
      if (m && /cobrar en caja/i.test(li.textContent)) return m[1]
    }
    return null
  })
const clickCobrarDe = (pid) =>
  page.evaluate((pid) => {
    for (const li of document.querySelectorAll('li')) {
      if (li.textContent.includes(`#${pid}`)) {
        const btn = [...li.querySelectorAll('button')].find((b) => /cobrar en caja/i.test(b.textContent))
        if (btn) { btn.click(); return true }
      }
    }
    return false
  }, pid)

for (let i = 0; i < 12; i++) {
  if (await clickTexto('marcar listo para retirar')) {
    await sleep(1600) // espera la mutación + re-render de la tarjeta
  }
  const pedido = await primerPedidoCola()
  if (!pedido) break // cola vacía
  if (vistos.has(pedido)) {
    await sleep(1500) // tarjeta recién entregada aún visible: esperar a que salga
    if (i > 8) break
    continue
  }
  vistos.add(pedido)
  ok(await clickCobrarDe(pedido), `encargo #${pedido} enviado a caja`)
  await sleep(1500) // navegación al POS + carga del ticket vía handoff
  if (!(await esperaTexto('cobrar $', 8000))) {
    ok(false, `ticket del encargo #${pedido} no cargó en el POS`)
    await irTab('encargos', 'pedidos por armar')
    continue
  }
  ok(true, `ticket del encargo #${pedido} cargado en el POS`)
  ok(await clickTexto('cobrar $'), `abrir modal de cobro encargo #${pedido}`)
  ok(await esperaTexto('confirmar cobro', 8000), 'modal de cobro abierto')
  ok(await clickTexto('confirmar cobro'), `confirmar cobro encargo #${pedido}`)
  const asentada = (await esperaTexto('venta registrada', 20000)) || (await hayTexto('descartó el ticket'))
  ok(asentada, `venta del encargo #${pedido} asentada`)
  if (procesados === 0) await shot('06-venta-encargo')
  await clickTexto('cerrar') // cierra el comprobante
  await sleep(600)
  procesados++
  await irTab('encargos', 'pedidos por armar')
}
ok(procesados >= 2, `se entregaron ${procesados} encargo(s) en caja`)

console.log('\n=== 6) VENDEDOR: VENTA DIRECTA EN POS ===')
await irTab('terminal pos', 'escanear')
ok(await clickIdx('.product-card-main', 0), 'agregar producto al ticket')
await sleep(500)
ok(await clickTexto('cobrar $'), 'abrir modal de cobro')
ok(await esperaTexto('confirmar cobro', 8000), 'modal de cobro abierto')
ok(await clickTexto('confirmar cobro'), 'confirmar cobro venta directa')
ok(await esperaTexto('venta registrada', 20000), 'venta directa asentada')
await clickTexto('cerrar')
await sleep(400)

console.log('\n=== 7) VENDEDOR: RESTO DE TABS ===')
await irTab('cobranzas', 'cobranz')
await irTab('stock rápido', 'stock')
ok(await clickIdx('button[aria-label="Sumar"]', 0), 'stock +1')
await sleep(600)
ok(await clickIdx('button[aria-label="Restar"]', 0), 'stock −1 (restaura)')
await sleep(600)
await irTab('catálogo', '¿qué se te antoja?')
await irTab('clientes', 'cliente')
await irTab('ventas', 'venta')
await irTab('mi actividad', 'actividad')
await irTab('mi cuenta', 'cuenta')
await logout()

console.log('\n=== 8) ADMIN: TODOS LOS MÓDULOS ===')
await login('demo admin', 'escanear')
await irTab('cobranzas', 'cobranz')
await irTab('encargos', 'pedidos por armar')
await irTab('stock rápido', 'stock')
await irTab('configuración', 'configuraci')
await shot('07-admin-config')
await irTab('productos', 'producto')
// Alta de producto: abre el formulario y lo cancela (ejerce el modal sin
// dejar basura en la base).
ok(await clickTexto('nuevo producto'), 'abrir alta de producto')
await sleep(600)
ok(await clickTexto('cancelar'), 'cerrar alta de producto')
await sleep(400)
await irTab('catálogo', '¿qué se te antoja?')
await irTab('vencimientos', 'vencimiento')
await irTab('clientes', 'cliente')
await irTab('ventas', 'venta')
await irTab('notificaciones', 'notificacion')
await irTab('reportes', 'reporte')
await shot('08-admin-reportes')
await logout()

console.log('\n================= RESULTADO =================')
console.log(`Pasos ejecutados: ${pasos} · Fallos: ${fallos}`)
if (pageErrors.length) {
  console.log('\n❌ Excepciones JS (pageerror):')
  pageErrors.forEach((e) => console.log('  •', e))
} else console.log('\n✅ Sin excepciones de JavaScript (pageerror).')
if (consoleErrors.length) {
  console.log('\n❌ Errores de consola:')
  consoleErrors.forEach((e) => console.log('  •', e))
} else console.log('✅ Sin errores de consola.')
if (badResponses.length) {
  console.log('\n❌ Respuestas HTTP >= 400:')
  badResponses.forEach((e) => console.log('  •', e))
} else console.log('✅ Sin respuestas HTTP >= 400 (nada de 500).')
if (failedRequests.length) {
  console.log('\n⚠ Requests fallidas:')
  failedRequests.forEach((e) => console.log('  •', e))
}

await browser.close()
process.exit(fallos || pageErrors.length || consoleErrors.length || badResponses.length ? 1 : 0)
