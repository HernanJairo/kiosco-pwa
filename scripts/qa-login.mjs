// QA login 390x844: eslogan top-left sobre el mosaico + scroll natural
// (la ilustración sube junto con el formulario, no queda fija).
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
fs.mkdirSync('capturas-guia/qa-login', { recursive: true })
let pasos = 0, fallos = 0
const ok = (c, n) => { pasos++; console.log(`  ${c ? '✔' : '✘'} ${n}`); if (!c) fallos++ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(1500)
// El splash tarda ~2.5s: esperar a que el formulario de login sea visible.
await page.waitForSelector('#login-ident', { visible: true, timeout: 15000 }).catch(() => {})
await page.evaluate(() => document.querySelector('.splash-skip')?.click())
await sleep(800)

const slogan = await page.evaluate(() => {
  const el = document.querySelector('.mosaic-slogan')
  if (!el) return null
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  return {
    txt: el.innerText,
    top: Math.round(r.top), left: Math.round(r.left),
    color: cs.color, spanColor: getComputedStyle(el.querySelector('span')).color,
    bg: cs.backgroundColor, blur: cs.backdropFilter || cs.webkitBackdropFilter,
    font: cs.fontSize, weight: cs.fontWeight,
  }
})
ok(!!slogan, 'eslogan presente sobre el mosaico')
ok(slogan && slogan.txt.toLowerCase().includes('tu kiosco') && slogan.txt.toLowerCase().includes('al toque'), `texto "Tu kiosco, / al toque." (${slogan?.txt.replace(/\n/g, ' / ')})`)
ok(slogan && slogan.top >= 0 && slogan.top < 60 && slogan.left < 30, `alineado arriba-izquierda (top ${slogan?.top}px, left ${slogan?.left}px)`)
ok(slogan && slogan.spanColor === 'rgb(0, 157, 224)', `segunda línea azul (${slogan?.spanColor})`)
ok(slogan && /blur/.test(slogan.blur), `backdrop translúcido con blur (${slogan?.blur})`)
await page.screenshot({ path: 'capturas-guia/qa-login/login-slogan.png' })

// Scroll natural: el mosaico debe subir (top negativo) al scrollear el shell.
const scroll = await page.evaluate(async () => {
  const shell = document.querySelector('.login-shell')
  const mosaic = document.querySelector('.mosaic')
  const antes = mosaic.getBoundingClientRect().top
  shell.scrollTo({ top: 400 })
  await new Promise((r) => setTimeout(r, 500))
  const despues = mosaic.getBoundingClientRect().top
  const shellScroll = shell.scrollTop
  return { antes: Math.round(antes), despues: Math.round(despues), shellScroll, formOverflow: getComputedStyle(document.querySelector('.form-panel')).overflowY }
})
ok(scroll.formOverflow !== 'auto', `form-panel sin scroll propio (${scroll.formOverflow})`)
ok(scroll.shellScroll > 0, `el shell scrolleó (${scroll.shellScroll}px)`)
ok(scroll.despues < scroll.antes, `la ilustración subió con el scroll (${scroll.antes} → ${scroll.despues}px)`)
await page.screenshot({ path: 'capturas-guia/qa-login/login-scrolled.png' })

console.log(`\nPasos: ${pasos} · Fallos: ${fallos}`)
console.log(errs.length ? `❌ pageerror: ${errs.join(' | ')}` : '✅ sin excepciones JS')
await browser.close()
process.exit(fallos || errs.length ? 1 : 0)
