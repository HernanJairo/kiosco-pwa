// QA E2E en Chrome real emulando móvil (390x844, touch): verifica los 6
// ajustes de UX — botón "+", notificaciones con filtro de fechas y orden
// DESC, fuentes de billetera >=14/13px, modal QR de la credencial,
// tarjetas de cobranza y Configuración al final del menú.
// Correr con `npm run dev` en :5173:  node scripts/qa-mobile.mjs
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.APP_URL || 'http://localhost:5173'
const OUT = 'capturas-guia/qa-mobile'
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
await page.emulate({
  viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  userAgent:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
})

page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('response', (r) => {
  if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`)
})
page.on('requestfailed', (r) => {
  const err = r.failure()?.errorText || ''
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
// Match exacto del texto: desambigua el atajo "Todas" de la píldora
// de categoría "Todas · N".
const clickExacto = (t, sel = 'button') =>
  page.evaluate(
    (x, s) => {
      const el = [...document.querySelectorAll(s)].find(
        (e) => e.textContent.trim().toLowerCase() === x && !e.disabled
      )
      if (el) { el.click(); return true }
      return false
    },
    t.toLowerCase(),
    sel
  )

const waitPage = async () => { await sleep(1100) }
const irTab = async (nombre, espera) => {
  // En móvil los tabs viven en el drawer (hamburguesa).
  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Abrir menú"]')
    b?.click()
  })
  await sleep(500)
  const fue = await clickTexto(nombre, 'nav button')
  if (fue === false) return ok(false, `tab "${nombre}"`)
  ok(true, `tab "${nombre}"`)
  await waitPage()
  if (espera) ok(await esperaTexto(espera), `"${nombre}" renderizó (${espera})`)
}
const login = async (boton, espera) => {
  ok(await esperaTexto(boton, 20000), `login visible para "${boton}"`)
  ok(await clickTexto(boton), `click "${boton}"`)
  await waitPage()
  ok(await esperaTexto(espera, 15000), `sesión iniciada (${espera})`)
}
const salir = async () => {
  ok(await clickTexto('salir'), 'click Salir')
  await waitPage()
}

// Font-size computado (px) del primer elemento que matchea.
const fontSize = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    return el ? parseFloat(getComputedStyle(el).fontSize) : null
  }, sel)

// Cantidad en el pedido/ticket de una tarjeta de producto.
const cantEnCard = (i) =>
  page.evaluate((n) => {
    const cards = [...document.querySelectorAll('.product-card')]
    const c = cards[n]
    return c ? Number(c.querySelector('.qs-count')?.textContent || 0) : null
  }, i)

// Guard de overflow horizontal: nada puede empujar el ancho > 390px.
const anchoOK = () => page.evaluate(() => document.documentElement.scrollWidth <= 391)

// Overflow interno: texto que desborda su propio contenedor
// (scrollWidth > clientWidth), en los selectores dados.
const textosDesbordados = (sels) =>
  page.evaluate((ss) => {
    const mal = []
    for (const sel of ss) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.scrollWidth > el.clientWidth + 1) mal.push(`${sel} → "${el.textContent.trim().slice(0, 30)}"`)
        if (el.scrollHeight > el.clientHeight + 1 && el.children.length === 0) {
          mal.push(`alto ${sel} → "${el.textContent.trim().slice(0, 30)}"`)
        }
      }
    }
    return mal
  }, sels)

// Extrae las fechas "dd/mm, HH:MM" de la lista de notificaciones.
const fechasNotifs = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('ul li')].map((li) => {
      const m = li.textContent.match(/(\d{2})\/(\d{2}),\s*(\d{2}):(\d{2})/)
      return m ? Number(m[1]) * 1440 + Number(m[3]) * 60 + Number(m[4]) : null
    }).filter((x) => x !== null)
  )
const descOK = (arr) => arr.every((v, i) => i === 0 || arr[i - 1] >= v)

console.log('=== QA MÓVIL 390x844 — ajustes UX ===\n')
await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(1200)

/* ---------------- CLIENTE ---------------- */
console.log('=== 1) CLIENTE: BOTÓN "+" EN CATÁLOGO ===')
await login('demo cliente', '¿qué se te antoja?')
const antes = await cantEnCard(0)
ok(await clickIdx('.add-button', 0), 'click botón "+" en tarjeta 1')
await sleep(600)
ok((await cantEnCard(0)) === (antes ?? 0) + 1, 'el "+" sumó 1 unidad directo a la tarjeta 1')
// Tras sumar, tarjeta 1 muestra el stepper: el primer ".add-button" que
// queda en DOM es ahora el de la tarjeta 2.
ok(await clickIdx('.add-button', 0), 'click botón "+" en tarjeta 2')
await sleep(600)
ok((await cantEnCard(1)) === 1, 'el "+" sumó en tarjeta 2')
// Carrusel de categorías: las píldoras no desbordan su borde
// ("Galletitas", "Almuerzos" quedaban cortadas con el piso global).
const desbordeCat = await textosDesbordados(['.category-card', '.stock-pill', '.sort-button', '.sort-select'])
ok(desbordeCat.length === 0, `catálogo: ninguna píldora/badge desborda (${desbordeCat.length})${desbordeCat.length ? ' :: ' + desbordeCat.slice(0, 3).join(' | ') : ''}`)

console.log('\n=== 2) CLIENTE: FUENTES DE BILLETERA (>=14px base / >=13px meta) ===')
await irTab('mi billetera', 'saldo disponible')
const checks = [
  ['.wallet-eyebrow', 13, 'eyebrow'],
  ['.balance-label', 14, 'etiqueta saldo'],
  ['.balance-caption', 13, 'caption saldo'],
  ['.quick-actions button strong', 14, 'botón acción rápida'],
  ['.credit-summary', 14, 'resumen crédito'],
  ['.transaction-info strong', 14, 'detalle movimiento'],
  ['.transaction-info span', 13, 'fecha movimiento'],
]
for (const [sel, min, nombre] of checks) {
  const px = await fontSize(sel)
  ok(px !== null && px >= min, `${nombre}: ${px}px >= ${min}px`)
}
await shot('m1-billetera-fuentes')

console.log('\n=== 3) CLIENTE: QR DE CREDENCIAL (MODAL, NO FULLSCREEN) ===')
await irTab('mi carnet', 'credencial digital')
ok(await clickTexto('ampliar y subir brillo'), 'click "Ampliar y subir brillo"')
await sleep(600)
const modal = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"][aria-label="Credencial ampliada"]')
  if (!d) return null
  const svg = d.querySelector('svg')
  const cs = getComputedStyle(d)
  return {
    bg: cs.backgroundColor,
    qrW: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
    texto: d.innerText.toLowerCase(),
    fullscreen: !!document.fullscreenElement,
  }
})
ok(!!modal, 'se abrió el modal interno de credencial')
ok(modal && !modal.fullscreen, 'NO usó requestFullscreen (modal interno)')
ok(modal && (modal.bg === 'rgb(255, 255, 255)' || modal.bg === '#fff'), `fondo blanco puro (${modal?.bg})`)
ok(modal && modal.qrW >= 300, `QR ocupa ~80% del ancho (${modal?.qrW}px de 390)`)
ok(modal && modal.texto.includes('maría gonzález') && modal.texto.includes('dni'), 'nombre y DNI grandes visibles')
await shot('m2-credencial-modal')
ok(await clickTexto('cerrar'), 'botón Cerrar del modal')
await sleep(500)
ok(!(await page.$('[aria-label="Credencial ampliada"]')), 'modal cerrado')

console.log('\n=== 4) CLIENTE: ENCARGO RÁPIDO (genera evento para el feed) ===')
await irTab('catálogo', '¿qué se te antoja?')
ok(await clickIdx('.add-button', 0), 'agregar producto con "+"')
ok(await clickTexto('ver mi pedido'), 'abrir "Ver mi pedido"')
await sleep(800)
ok(await clickTexto('retirar pedido en local'), 'abrir "Retirar pedido en local"')
await sleep(800)
ok(await clickTexto('retiro yo'), 'elegir "Retiro yo"')
ok(await clickTexto('confirmar encargo'), 'click "Confirmar encargo"')
ok(await esperaTexto('encargo', 15000), 'encargo confirmado')
await clickTexto('cerrar')
await salir()

/* ---------------- VENDEDOR ---------------- */
console.log('\n=== 5) VENDEDOR: BOTÓN "+" EN POS + FIADOS PAUSADOS + COBRANZA ===')
await login('demo vendedor', 'terminal pos')
// El POS arranca en Terminal POS: probar el "+" en una tarjeta.
// ("Escanear" es placeholder, no innerText; mejor esperar la grilla.)
ok(await page.waitForSelector('.add-button', { timeout: 15000 }).then(() => true).catch(() => false), 'POS del vendedor visible')
const antesV = await cantEnCard(0)
ok(await clickIdx('.add-button', 0), 'click botón "+" en tarjeta del POS')
await sleep(600)
ok((await cantEnCard(0)) === (antesV ?? 0) + 1, 'el "+" del POS sumó al ticket')
// Tipografía del POS: nombre de producto grande; píldoras/badges
// compactos (sin desbordar). El overflow interno es lo que importa.
ok((await fontSize('.product-name')) >= 13.4, `nombre de producto legible (${await fontSize('.product-name')}px)`)
ok((await fontSize('.stock-pill')) >= 9.5, `pill de stock ~10px (${await fontSize('.stock-pill')}px)`)
ok((await fontSize('.product-category')) >= 10.5, `categoría ~11px (${await fontSize('.product-category')}px)`)
const desbordePOS = await textosDesbordados(['.stock-pill', '.product-category', '.category-card', '.product-name', '.qs-count'])
ok(desbordePOS.length === 0, `POS: ningún texto desborda (${desbordePOS.length})${desbordePOS.length ? ' :: ' + desbordePOS.slice(0, 3).join(' | ') : ''}`)
ok(await anchoOK(), 'POS sin overflow horizontal')
await shot('m3-pos-plus')

// Contingencia: el vendedor pausa los fiados desde "Mi Actividad".
await irTab('mi actividad', 'estado del servicio')
ok(
  await page.evaluate(() => {
    const p = [...document.querySelectorAll('p')].find((x) => /fiados \(cta/i.test(x.textContent))
    const row = p?.closest('div')?.parentElement?.parentElement
    const sw = row?.querySelector('button[role="switch"]')
    sw?.click()
    return !!sw
  }),
  'vendedor pausó los fiados (switch Estado del Servicio)'
)
ok(await esperaTexto('pausados', 10000), 'fiados quedaron en "Pausados"')
await sleep(800)
// Deduplicación: el toggle debe dejar UNA sola notificación limpia,
// no un par admin+staff redundante.
const notifsFiado = await page.evaluate(() =>
  [...document.querySelectorAll('ul li')].filter((li) => /fiados pausados/i.test(li.textContent)).length
)
ok(notifsFiado === 1, `una sola notif limpia por el toggle (${notifsFiado})`)
ok(await esperaTexto('fiados pausados · por marcos mostrador (vendedor)', 6000), 'texto de notif unificado "· por Nombre (rol)"')

// Con fiados pausados el método Cta. Corriente debe bloquearse.
await irTab('terminal pos')
ok(await page.waitForSelector('.add-button', { timeout: 15000 }).then(() => true).catch(() => false), 'POS visible tras pausar fiados')
await clickIdx('.add-button', 0)
await sleep(600)
ok(
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /cobrar \$/i.test(x.textContent) && !x.disabled)
    b?.click()
    return !!b
  }),
  'abrió modal de cobro'
)
await sleep(900)
const fiadoVend = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /cta\.? ?corriente|fiado/i.test(x.textContent))
  return b ? { disabled: b.disabled, texto: b.textContent.toLowerCase() } : null
})
ok(!!fiadoVend, 'botón "Cta. Corriente" presente en el modal')
ok(fiadoVend && fiadoVend.disabled, 'método Fiado DESHABILITADO para el vendedor')
ok(await esperaTexto('los fiados están pausados actualmente', 6000), 'aviso "Los fiados están pausados actualmente" visible')
await shot('m4-pos-fiado-bloqueado')
// El vendedor igual puede cobrar por otro método (efectivo).
ok(await clickTexto('confirmar cobro'), 'confirmó cobro en efectivo con fiados pausados')
ok(await esperaTexto('venta registrada', 10000), 'venta en efectivo registrada')
await clickTexto('listo')
await sleep(600)
await clickTexto('cerrar')
await sleep(600)

// "Cierre de puertas": el vendedor cierra el local desde el TopBar y
// sigue cobrando a los clientes que quedaron adentro.
ok(
  await page.evaluate(() => {
    const sw = document.querySelector('header button[role="switch"]')
    if (!sw || sw.getAttribute('aria-checked') !== 'true') return false
    sw.click()
    return true
  }),
  'vendedor cerró el local (switch TopBar)'
)
await sleep(900)
ok(await esperaTexto('cerrado', 6000), 'TopBar marca "Cerrado"')
// El POS sigue habilitado para el mostrador con el local cerrado.
ok(await page.waitForSelector('.add-button', { timeout: 10000 }).then(() => true).catch(() => false), 'POS sigue operativo con local cerrado')
await clickIdx('.add-button', 0)
await sleep(600)
ok(
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /cobrar \$/i.test(x.textContent) && !x.disabled)
    b?.click()
    return !!b
  }),
  'modal de cobro abre con local cerrado'
)
await sleep(900)
ok(await esperaTexto('local cerrado', 5000), 'aviso sutil "con local cerrado" en el POS')
ok(await clickTexto('confirmar cobro'), 'cobró con local cerrado')
ok(await esperaTexto('venta registrada con local cerrado', 10000), 'toast "Venta registrada con local cerrado"')
await clickTexto('listo')
await sleep(600)
await clickTexto('cerrar')
await sleep(600)

// Anular venta: la venta en efectivo recién hecha queda revertida y
// el feed recibe "Venta anulada · $X (N ítems)".
await irTab('ventas', 'mis ventas')
ok(
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /anular/i.test(x.textContent) && !x.disabled)
    b?.click()
    return !!b
  }),
  'abrió confirmación de anulación'
)
await sleep(700)
ok(await clickTexto('anular venta'), 'confirmó "Anular venta"')
ok(await esperaTexto('venta anulada', 10000), 'venta anulada (stock/deuda revertidos)')
await sleep(600)

// Reabrir el local para que el admin llegue al POS abierto.
ok(
  await page.evaluate(() => {
    const sw = document.querySelector('header button[role="switch"]')
    if (!sw || sw.getAttribute('aria-checked') !== 'false') return false
    sw.click()
    return true
  }),
  'vendedor reabrió el local'
)
await sleep(900)

// Procesar el encargo del cliente: "Marcar listo" genera un evento
// propio del vendedor para su feed de actividad.
await irTab('encargos', 'pedidos por armar')
ok(await clickTexto('marcar listo'), 'vendedor marca el encargo como listo')
await sleep(900)
ok(await anchoOK(), 'Encargos sin overflow horizontal')

await irTab('cobranzas', 'buscar cliente')
// Estética de tarjetas: filas altas con ícono grande + badge de deuda.
const fila = await page.evaluate(() => {
  const b = [...document.querySelectorAll('ul li button')].find((x) => /dni/i.test(x.textContent))
  if (!b) return null
  const r = b.getBoundingClientRect()
  const icon = b.querySelector('div')
  return { alto: Math.round(r.height), icono: icon ? Math.round(icon.getBoundingClientRect().width) : 0, texto: b.innerText.toLowerCase() }
})
ok(fila && fila.alto >= 56, `fila de cliente en cobranza >=56px (${fila?.alto}px)`)
ok(fila && fila.icono >= 36, `ícono grande de cliente (${fila?.icono}px)`)
// Seleccionar el primer cliente con deuda (María González tiene fiados seed).
await page.evaluate(() => {
  const b = [...document.querySelectorAll('ul li button')].find((x) => /maría|maria/i.test(x.textContent))
  b?.click()
})
await sleep(800)
const fiado = await page.evaluate(() => {
  const li = [...document.querySelectorAll('li')].find((x) => /total fiado/i.test(x.textContent))
  return li ? { sombra: getComputedStyle(li).boxShadow !== 'none', texto: li.innerText.toLowerCase() } : null
})
ok(!!fiado, 'tarjeta de fiado estilo Libreta presente')
ok(fiado && fiado.sombra, 'tarjeta de fiado con sombra suave (shadow-soft)')
ok(fiado && fiado.texto.includes('total fiado') && fiado.texto.includes('pendiente'), 'fiado muestra total y pendiente claros')
const btnAlto = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /cargar saldo/i.test(x.textContent))
  return b ? Math.round(b.getBoundingClientRect().height) : null
})
ok(btnAlto !== null && btnAlto >= 40, `botón "Cargar saldo" grande (${btnAlto}px)`)
await shot('m4-cobranza-tarjetas')

await irTab('mi actividad', 'actividad')
// Filtro de fechas colapsable: píldoras limpias y el rango oculto
// tras "Elegir por fecha".
ok(await esperaTexto('hoy', 8000) && (await esperaTexto('7 días', 2000)) && (await esperaTexto('todas', 2000)), 'atajos Hoy / 7 días / Todas presentes')
ok(await esperaTexto('elegir por fecha', 3000), 'píldora "Elegir por fecha" presente')
ok((await page.$$('input[type="date"]')).length === 0, 'inputs Desde/Hasta OCULTOS hasta abrir el panel')
ok(await clickTexto('elegir por fecha'), 'abrió el panel de fechas')
await sleep(600)
ok((await page.$$('input[type="date"]')).length === 2, 'panel muestra Desde y Hasta')
const fVend = await fechasNotifs()
ok(fVend.length >= 1, `feed del vendedor con ${fVend.length} evento(s) (marcar listo)`)
ok(descOK(fVend), 'notificaciones ordenadas DESC (más reciente primero)')
// El feed del vendedor refleja los 2 eventos nuevos del turno.
ok(await esperaTexto('venta (con local cerrado)', 6000), 'feed marca la venta "(con local cerrado)"')
ok(await esperaTexto('venta anulada', 6000), 'feed marca "Venta anulada · $X (N ítems)"')
await shot('m5-actividad-filtros')
await salir()

/* ---------------- ADMIN ---------------- */
console.log('\n=== 6) ADMIN: FIADO CON EXCEPCIÓN + "+" + NOTIFS + MENÚ ===')
await login('demo admin', 'terminal pos')
ok(await page.waitForSelector('.add-button', { timeout: 15000 }).then(() => true).catch(() => false), 'POS del admin visible')

// Fiados siguen pausados (los pausó el vendedor): el admin sí puede
// elegir Cta. Corriente, con marca de excepción.
const antesA = await cantEnCard(0)
ok(await clickIdx('.add-button', 0), 'click botón "+" en POS admin')
await sleep(600)
const despA = await cantEnCard(0)
ok(despA === (antesA ?? 0) + 1, `el "+" del POS admin sumó (${antesA} → ${despA})`)
ok(
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /cobrar \$/i.test(x.textContent) && !x.disabled)
    b?.click()
    return !!b
  }),
  'admin abrió modal de cobro'
)
await sleep(900)
const fiadoAdm = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /cta\.? ?corriente/i.test(x.textContent))
  return b ? { disabled: b.disabled, excepcion: /excepción/i.test(b.textContent) } : null
})
ok(fiadoAdm && !fiadoAdm.disabled, 'método Fiado HABILITADO para el admin')
ok(fiadoAdm && fiadoAdm.excepcion, 'botón Fiado marca "excepción"')
ok(await clickTexto('cta. corriente'), 'admin eligió Cta. Corriente')
await sleep(700)
ok(await esperaTexto('autorizando una excepción', 5000), 'aviso de excepción de admin visible')
// Cliente obligatorio para fiado: María González tiene límite de
// cuenta corriente habilitado en el seed.
ok(
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('ul li button')].find((x) => /maría|maria/i.test(x.textContent))
    b?.click()
    return !!b
  }),
  'admin seleccionó cliente con cuenta corriente (María)'
)
await sleep(600)
ok(await clickTexto('confirmar cobro'), 'admin confirmó cobro fiado')
await sleep(1200)
// Si el límite del cliente exige excepción extra, confirmarla también.
await clickTexto('confirmar excepción y cobrar')
await sleep(1200)
ok(await esperaTexto('venta registrada', 10000), 'venta fiada de excepción registrada')
await shot('m5-admin-fiado-excepcion')
await clickTexto('listo')
await sleep(600)
await clickTexto('cerrar')
await sleep(600)

await irTab('catálogo', '¿qué se te antoja?')
const antesCat = await cantEnCard(0)
ok(await clickIdx('.add-button', 0), 'click botón "+" en catálogo admin')
await sleep(600)
ok((await cantEnCard(0)) === (antesCat ?? 0) + 1, 'el "+" del catálogo admin sumó')
const desbordeCatAdm = await textosDesbordados(['.category-card', '.stock-pill'])
ok(desbordeCatAdm.length === 0, `catálogo admin: píldoras sin desborde (${desbordeCatAdm.length})`)
ok(await anchoOK(), 'Catálogo admin sin overflow horizontal')

await irTab('notificaciones', 'notificaciones')
// La venta fiada del admin debe estar marcada en el feed.
ok(await esperaTexto('fiados pausados - autorizado por admin', 10000), 'feed marca "(Fiados pausados - autorizado por Admin)"')
// Filtro de fechas colapsable: solo píldoras visibles; el rango
// Desde/Hasta aparece al tocar "Elegir por fecha".
ok(await esperaTexto('hoy', 8000) && (await esperaTexto('7 días', 2000)) && (await esperaTexto('todas', 2000)), 'atajos de fecha presentes')
ok(await esperaTexto('elegir por fecha', 3000), 'píldora "Elegir por fecha" presente')
ok((await page.$$('input[type="date"]')).length === 0, 'inputs de fecha ocultos por defecto')
ok(await clickTexto('elegir por fecha'), 'abrió el panel de fechas')
await sleep(600)
// Selector compacto: 2 columnas iguales, píldoras ~38px, fuente chica.
const pill = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('label')].filter((l) => l.querySelector('input[type="date"]'))
  if (labels.length !== 2) return { n: labels.length }
  const grid = labels[0].parentElement
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean)
  return {
    n: 2,
    cols: cols.length,
    iguales: cols.length === 2 && Math.abs(parseFloat(cols[0]) - parseFloat(cols[1])) < 1,
    alto: Math.round(labels[0].getBoundingClientRect().height),
  }
})
ok(pill.n === 2 && pill.cols === 2 && pill.iguales, `Desde/Hasta en 2 columnas iguales (${JSON.stringify(pill)})`)
ok(pill.alto !== undefined && pill.alto <= 42, `píldoras de fecha compactas ~38px (${pill.alto}px)`)
const fAdm = await fechasNotifs()
ok(fAdm.length >= 2, `feed del admin con ${fAdm.length} eventos`)
ok(descOK(fAdm), 'notificaciones del admin en orden DESC estricto')
// Tipografía del feed: cuerpo ~13px, fecha/autor ~11px, sin desborde.
const fFeed = await page.evaluate(() => {
  const li = document.querySelector('ul li')
  if (!li) return null
  const ps = [...li.querySelectorAll('p')]
  return ps.map((p) => parseFloat(getComputedStyle(p).fontSize))
})
ok(fFeed && fFeed[0] >= 12.4, `texto del feed ~13px (${fFeed?.[0]}px)`)
ok(fFeed && fFeed[1] >= 10.4, `fecha del feed ~11px (${fFeed?.[1]}px)`)
// Atajo "Hoy": todo lo listado debe ser de hoy (nuestros eventos son de hoy).
// Match exacto para no confundir con las píldoras de categoría.
ok(await clickExacto('hoy'), 'click atajo "Hoy"')
await sleep(800)
const fHoy = await fechasNotifs()
const hoyDia = new Date().getDate()
ok(fHoy.every((f) => Math.floor(f / 1440) === hoyDia), '"Hoy" filtra solo eventos de hoy')
// Rango manual imposible → lista vacía.
await page.evaluate(() => {
  const inp = document.querySelector('input[type="date"]')
  if (!inp) return
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '2099-01-01')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(600)
await page.evaluate(() => {
  const inps = document.querySelectorAll('input[type="date"]')
  const inp = inps[1]
  if (!inp) return
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '2099-12-31')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(800)
ok(await esperaTexto('sin eventos', 8000), 'rango Desde/Hasta filtra (2099 → vacío)')
ok(await clickExacto('todas'), 'click atajo "Todas"')
await sleep(900)
const fTodas = await fechasNotifs()
ok(fTodas.length >= fAdm.length, `"Todas" restaura el listado completo (${fTodas.length}/${fAdm.length})`)
ok(await anchoOK(), 'Notificaciones sin overflow horizontal')
await shot('m6-admin-notifs')

// Tipografía de Reportes (.analytics-view): datos >=13.5px, leyendas >=12.5px.
await irTab('reportes', 'reportes')
const fRep = await page.evaluate(() => {
  const pick = (s) => { const el = document.querySelector(s); return el ? parseFloat(getComputedStyle(el).fontSize) : null }
  return { kpi: pick('.kpi-label'), pill: pick('.period-pill'), legend: pick('.category-legend-row'), tabla: pick('.bestseller-table td') }
})
ok(fRep.pill !== null && fRep.pill >= 10.4, `píldoras de período ~11px (${fRep.pill}px)`)
ok(fRep.kpi !== null && fRep.kpi >= 12.4, `labels KPI >=12.5px (${fRep.kpi}px)`)
ok(fRep.legend !== null && fRep.legend >= 12.4, `leyenda de categorías >=12.5px (${fRep.legend}px)`)
const desbordeRep = await textosDesbordados(['.analytics-view .period-pill', '.analytics-view .status-filter', '.analytics-view .stock-badge', '.analytics-view .inventory-category-chip', '.analytics-view .management-tab'])
ok(desbordeRep.length === 0, `Reportes: ningún texto desborda (${desbordeRep.length})${desbordeRep.length ? ' :: ' + desbordeRep.slice(0, 3).join(' | ') : ''}`)
ok(await anchoOK(), 'Reportes sin overflow horizontal')
await shot('m7-reportes-tipografia')

// El admin cobra en caja el encargo que el vendedor dejó listo: cierra
// el ciclo real y deja la cola vacía al terminar el QA.
await irTab('encargos', 'pedidos por armar')
if (await clickTexto('cobrar en caja')) {
  ok(true, 'admin abrió "Cobrar en caja" del encargo listo')
  await sleep(1200)
  const pago = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /cobrar \$/i.test(x.textContent) && !x.disabled)
    if (b) { b.click(); return true }
    return false
  })
  ok(pago, 'admin cobró el encargo en el POS')
  await sleep(900)
  await clickTexto('listo')
  await sleep(700)
  await clickTexto('cerrar')
} else {
  ok(false, 'admin abrió "Cobrar en caja" del encargo listo')
}

// Menú hamburguesa: Configuración debe ser el último ítem del drawer.
await page.evaluate(() => document.querySelector('button[aria-label="Abrir menú"]')?.click())
await sleep(600)
const ultimo = await page.evaluate(() => {
  const navs = [...document.querySelectorAll('nav')]
  const drawer = navs.find((n) => n.closest('[role="dialog"]'))
  if (!drawer) return null
  const btns = [...drawer.querySelectorAll('button')].map((b) => b.textContent.trim().toLowerCase())
  const idx = btns.findIndex((b) => b.includes('acerca de'))
  const items = idx >= 0 ? btns.slice(0, idx) : btns
  return items.filter((b) => b && !b.includes('cerrar') && !/administración · mi perfil/.test(b)).pop()
})
ok(ultimo === 'configuración', `Configuración es el último ítem del menú (${ultimo})`)
await shot('m7-menu-config-final')
await salir()

console.log('\n================= RESULTADO =================')
console.log(`Pasos ejecutados: ${pasos} · Fallos: ${fallos}`)
if (pageErrors.length) {
  console.log('\n❌ Excepciones JS (pageerror):')
  pageErrors.forEach((e) => console.log(`  • ${e}`))
} else console.log('\n✅ Sin excepciones de JavaScript (pageerror).')
if (consoleErrors.length) {
  console.log('\n❌ Errores de consola:')
  consoleErrors.slice(0, 20).forEach((e) => console.log(`  • ${e}`))
} else console.log('✅ Sin errores de consola.')
if (badResponses.length || failedRequests.length) {
  console.log('\n❌ Respuestas HTTP >= 400 / requests fallidas:')
  badResponses.slice(0, 15).forEach((e) => console.log(`  • ${e}`))
  failedRequests.slice(0, 15).forEach((e) => console.log(`  • ${e}`))
} else console.log('✅ Sin respuestas HTTP >= 400 (nada de 500).')

await browser.close()
process.exit(fallos || pageErrors.length || consoleErrors.length ? 1 : 0)
