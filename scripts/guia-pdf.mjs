// Genera Guia_Completa_Yapa.pdf: deck 16:9 con capturas reales de la app.
// Uso: node scripts/guia-pdf.mjs  (lee ./capturas-guia/*.png)
import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'node:fs'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const phone = (img, cap = '') => `
  <figure class="phone">
    <img src="capturas-guia/${img}.png" alt="${cap}">
    ${cap ? `<figcaption>${cap}</figcaption>` : ''}
  </figure>`

const slides = []

/* ---------- 1. Portada ---------- */
slides.push(`
<section class="slide cover">
  <div class="cover-grid">
    <div>
      <div class="logo-row"><span class="logo-mark">Y</span><span class="logo-name">Yapa</span></div>
      <p class="kicker">GUÍA VISUAL DEL SISTEMA · VERSIÓN 1.4</p>
      <h1>Tu kiosco de siempre,<br><em>ahora más rápido.</em></h1>
      <p class="lead">Guía completa para el equipo: qué hace la app, cómo se usa
      en el día a día y qué probar antes de la entrega final.</p>
      <div class="chips">
        <span>Pensada para celular</span><span>Funciona sin internet</span><span>Todo en tiempo real</span>
      </div>
    </div>
    <div class="cover-shots">${phone('02-catalogo')}${phone('09-pos-ticket')}</div>
  </div>
  <p class="foot">Kiosco Los Pinos · Proyecto Yapa · ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
</section>`)

/* ---------- 2. Qué es Yapa ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">RESUMEN GENERAL</p>
  <h2>¿Qué es <span class="brand">Yapa</span>?</h2>
  <p class="lead2">Es la app del kiosco: el catálogo, la caja, las fiados y los encargos,
  todo en un solo lugar. Se usa desde el navegador del celular — <b>no hay que descargar nada</b> —
  y se puede instalar como app con un toque.</p>
  <div class="cards3">
    <div class="card"><b>Tiempo real</b><p>Lo que un cliente hace en su celular aparece al instante en la caja
    (y al revés). Todo se sincroniza por la nube de Firebase.</p></div>
    <div class="card"><b>Sigue andando sin internet</b><p>Si se corta el wifi, el mostrador sigue vendiendo:
    los cambios se guardan en el aparato y se suben solos cuando vuelve la señal.</p></div>
    <div class="card"><b>Reglas del negocio cuidadas</b><p>El sistema frena solo: no deja vender sin stock,
    no deja fiar más del límite y dos cajas no pueden vender la última unidad a la vez.</p></div>
  </div>
  <div class="row-shots">${phone('01-login', 'Acceso: DNI + PIN de 4 dígitos')}</div>
</section>`)

/* ---------- 3. Un día con Yapa ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">EL DÍA A DÍA</p>
  <h2>Un día normal con Yapa, paso a paso</h2>
  <div class="timeline">
    <div class="step"><i>1</i><div><b>El cliente entra desde su celular</b><p>Abre el link del kiosco, mira el catálogo con fotos y precios, y entra con su DNI + PIN de 4 dígitos. Si no tiene cuenta, se registra solo desde "Crear cuenta".</p></div></div>
    <div class="step"><i>2</i><div><b>Carga saldo o pide fiado</b><p>En el mostrador le cargan saldo a su billetera, o compra a cuenta corriente ("fiado") si tiene el cupo habilitado por la dueña.</p></div></div>
    <div class="step"><i>3</i><div><b>Hace un encargo con QR Express</b><p>Arma el pedido desde el catálogo, lo manda por la app y recibe un QR. Puede autorizar a otra persona a retirarlo.</p></div></div>
    <div class="step"><i>4</i><div><b>La caja lo cobra en segundos</b><p>El vendedor ve el encargo llegar al instante, lo prepara, marca "listo para retirar" y cobra en el Terminal POS con efectivo, transferencia, saldo o fiado.</p></div></div>
    <div class="step"><i>5</i><div><b>Todo queda registrado</b><p>Cada venta, pago, fiado y anulación queda en el historial y en los reportes del día — al centavo.</p></div></div>
  </div>
</section>`)

/* ---------- 4. Roles ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">ROLES Y PERMISOS</p>
  <h2>Quién puede hacer qué</h2>
  <table class="tbl">
    <tr><th></th><th>Cliente</th><th>Vendedor</th><th>Administrador</th></tr>
    <tr><td>Ver catálogo y precios</td><td>✔</td><td>✔</td><td>✔</td></tr>
    <tr><td>Encargar, billetera, carnet QR, historial</td><td>✔</td><td>—</td><td>—</td></tr>
    <tr><td>Cobrar en el POS, anular ventas, cobranzas</td><td>—</td><td>✔</td><td>✔</td></tr>
    <tr><td>Preparar y entregar encargos, stock rápido</td><td>—</td><td>✔</td><td>✔</td></tr>
    <tr><td>Cargar saldo / cobrar deudas de clientes</td><td>—</td><td>✔</td><td>✔</td></tr>
    <tr><td>Editar clientes, resetear PIN, eliminar</td><td>—</td><td>—</td><td>✔</td></tr>
    <tr><td>Productos, vencimientos, reportes, configuración</td><td>—</td><td>—</td><td>✔</td></tr>
  </table>
  <div class="demo-box">
    <b>Accesos de prueba (demo):</b> en la pantalla de login hay botones <b>"Demo Cliente / Vendedor / Admin"</b>.
    Clientes de prueba: <b>María</b> DNI 45111222 · PIN 1234 · <b>Juan</b> DNI 46333444 · PIN 4321.
    Personal: usuario <b>admin</b> o <b>vendedor</b> · PIN 1234.
  </div>
</section>`)

/* ---------- 5. Módulo 1 ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">MÓDULO 1 · CATÁLOGO Y ACCESO</p>
  <h2>El vidriera del kiosco, en el bolsillo</h2>
  <div class="split">
    <div class="txt">
      <p class="lead2"><b>Para qué sirve:</b> los vecinos miran precios y stock antes de venir, y encargan sin llamar.</p>
      <ul class="feat">
        <li>Catálogo público con fotos reales, buscador y filtros por categoría.</li>
        <li>Detalle de producto con <b>galería de fotos, carrusel y zoom</b> a pantalla completa.</li>
        <li>Botones rápidos <b>[ − | n | + ]</b> en cada tarjeta para armar el pedido sin entrar al detalle.</li>
        <li>Encargo directo desde el celular con opción de <b>tercero autorizado</b> y QR Express.</li>
        <li>Login doble: clientes con DNI + PIN, personal con usuario + PIN. Auto-registro y recupero de PIN.</li>
        <li>Las categorías nuevas pueden llevar <b>emoji propio</b> (se ve en toda la app).</li>
      </ul>
    </div>
    <div class="shots">${phone('02-catalogo')}${phone('03-producto-detalle')}${phone('07-cliente-catalogo')}</div>
  </div>
</section>`)

/* ---------- 6. Cliente: billetera / carnet / encargos ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">MÓDULO 4 · LADO DEL CLIENTE</p>
  <h2>Billetera, Carnet QR y Encargos del vecino</h2>
  <div class="split">
    <div class="txt">
      <ul class="feat">
        <li><b>Mi Billetera:</b> saldo a favor, deuda de fiado y movimientos. Botón para pagar por transferencia con el alias del kiosco.</li>
        <li><b>Mi Carnet:</b> QR personal para pagar en caja sin decir el DNI — el mostrador lo escanea y listo. Se puede agrandar y subir el brillo.</li>
        <li><b>Mis Encargos:</b> estado de cada pedido (en preparación → listo → entregado) con su QR de retiro.</li>
        <li><b>Historial y Soporte:</b> compras anteriores y ayuda directa.</li>
      </ul>
    </div>
    <div class="shots">${phone('04-cliente-billetera')}${phone('05-cliente-carnet-qr')}${phone('06-cliente-encargos')}</div>
  </div>
</section>`)

/* ---------- 7. POS ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">MÓDULO 5 · TERMINAL POS (CAJA)</p>
  <h2>Cobrar en segundos, sin calculadora</h2>
  <div class="split">
    <div class="txt">
      <ul class="feat">
        <li>Tarjetas grandes con foto, precio y stock; <b>buscador + lector de código de barras</b> con la cámara.</li>
        <li>Ticket con steppers [ − | + ], total en vivo y atajos a cobrar.</li>
        <li>4 formas de pago: <b>efectivo, transferencia, saldo de billetera y fiado</b> (con límite y excepción controlada).</li>
        <li>Escanea el carnet del cliente para cobrarle con su saldo o su cuenta corriente.</li>
        <li><b>Anti-sobreventa:</b> el descuento de stock es una transacción en la nube — si dos cajas venden la última unidad, una sola gana.</li>
        <li>Anulación con reversa exacta de stock, saldo y deuda.</li>
      </ul>
    </div>
    <div class="shots wide">${phone('09-pos-ticket')}<figure class="desk"><img src="capturas-guia/21-pos-desktop.png"><figcaption>La misma caja en pantalla grande</figcaption></figure></div>
  </div>
</section>`)

/* ---------- 8. Encargos / Cobranza / Stock ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">MÓDULO 5 · MOSTRADOR</p>
  <h2>Encargos, cobranzas y stock rápido</h2>
  <div class="split">
    <div class="txt">
      <ul class="feat">
        <li><b>Panel de Encargos:</b> pedidos entrantes en vivo, "listo para retirar", retiro por DNI del titular o del tercero autorizado, rótulo imprimible y "cobrar en caja" que pasa el pedido directo al POS.</li>
        <li><b>Cobranzas:</b> recarga de saldo y cobro de fiados con pago parcial o total.</li>
        <li><b>Stock Rápido:</b> sumar mercadería al llegar el repartidor sin abrir el ABM completo.</li>
        <li>Ajuste por faltante: si falta un ítem del encargo, el stock reservado vuelve a la góndola solo.</li>
      </ul>
    </div>
    <div class="shots">${phone('10-encargos-panel')}${phone('11-cobranza')}${phone('12-stock-rapido')}</div>
  </div>
</section>`)

/* ---------- 9. Productos ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">MÓDULO 2 · PRODUCTOS</p>
  <h2>Gestión del inventario con fotos livianas</h2>
  <div class="split">
    <div class="txt">
      <ul class="feat">
        <li>Alta y edición con <b>varias fotos por producto</b> (cámara o galería): se comprimen solas a WebP liviano antes de guardar.</li>
        <li><b>Nueva categoría con emoji a elección</b> — grilla de 24 opciones o cualquier emoji del teclado; se sincroniza a todos los dispositivos.</li>
        <li>Códigos de barras múltiples por producto, con control de duplicados.</li>
        <li>Validaciones firmes: precio &gt; 0, stock y mínimo sin negativos, tope de tamaño del documento.</li>
        <li>Stock mínimo y fecha de vencimiento alimentan las alertas.</li>
      </ul>
    </div>
    <div class="shots">${phone('13-productos-abm')}${phone('15-producto-emoji')}</div>
  </div>
</section>`)

/* ---------- 10. Libreta de clientes ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">MÓDULO 4 · LIBRETA DE CLIENTES</p>
  <h2>Saldos, fiados y cobranza, ordenados</h2>
  <div class="split">
    <div class="txt">
      <ul class="feat">
        <li>Tarjeta por cliente con saldo a favor y deuda, historial completo y pagos parciales o totales.</li>
        <li>Cuenta corriente con límite propio por cliente (o el global del kiosco) y habilitación manual.</li>
        <li>Alta de cliente con ficha de confirmación (nombre + DNI + PIN) listo para anotar o mandar por WhatsApp.</li>
        <li>En celular: buscador grande, datos sin cortar y botones táctiles cómodos.</li>
        <li>Límites por rol: el vendedor opera cobranzas pero <b>no puede editar datos personales, resetear PIN ni borrar clientes</b>.</li>
      </ul>
    </div>
    <div class="shots">${phone('16-clientes-libreta')}<figure class="desk"><img src="capturas-guia/23-clientes-desktop.png"><figcaption>Vista de escritorio</figcaption></figure></div>
  </div>
</section>`)

/* ---------- 11. Reportes ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">MÓDULO 6 · REPORTES Y ANALÍTICA</p>
  <h2>El negocio en números, al centavo</h2>
  <div class="split">
    <div class="txt">
      <ul class="feat">
        <li>KPIs del período: recaudación, ganancia neta estimada, capital en fiados y productos bajo mínimo.</li>
        <li>Filtros Hoy / Semana / Mes / Rango personalizado y <b>exportación del reporte</b>.</li>
        <li>Dona de ventas por categoría, caja por método de pago y Top-10 de productos.</li>
        <li>Recomendaciones automáticas: combos que se repiten, stock inmovilizado y reposición prioritaria.</li>
        <li>En celular: tipografía legible y cero scroll lateral.</li>
      </ul>
    </div>
    <div class="shots">${phone('17-reportes')}<figure class="desk"><img src="capturas-guia/22-reportes-desktop.png"><figcaption>Vista de escritorio</figcaption></figure></div>
  </div>
</section>`)

/* ---------- 12. Vencimientos / Notifs / Config ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">MÓDULO 3 + ADMINISTRACIÓN</p>
  <h2>Vencimientos, avisos y configuración</h2>
  <div class="split">
    <div class="txt">
      <ul class="feat">
        <li><b>Vencimientos:</b> lista ordenada por urgencia con semáforo de días restantes.</li>
        <li><b>Notificaciones:</b> campanita con encargos nuevos, cobros, solicitudes de clientes y auditoría de acciones.</li>
        <li><b>Configuración:</b> datos del kiosco, equipo de personal y las <b>contingencias</b> — pausar fiados o encargos con un toque (se refleja al instante en todos lados).</li>
        <li>Abrir/cerrar local desde la barra superior: el catálogo muestra el estado en vivo.</li>
      </ul>
    </div>
    <div class="shots">${phone('19-vencimientos')}${phone('18-notificaciones')}${phone('20-config')}</div>
  </div>
</section>`)

/* ---------- 13. Checklist ---------- */
slides.push(`
<section class="slide">
  <p class="kicker">HOJA DE RUTA DE PRUEBAS</p>
  <h2>Checklist para el equipo</h2>
  <p class="lead2">Cada uno prueba su parte desde un celular. Si algo falla, anoten pantalla + qué pasaba + captura.</p>
  <div class="check-grid">
    <div class="chk"><b>Catálogo / Cliente</b>
      <label>☐ Entrar con DNI + PIN y registrarse nuevo</label>
      <label>☐ Abrir fotos, pasar el carrusel y hacer zoom</label>
      <label>☐ Encargar 2 productos y guardar el QR</label>
      <label>☐ Ver saldo, deuda y carnet</label></div>
    <div class="chk"><b>Mostrador / Vendedor</b>
      <label>☐ Cobrar una venta de varios ítems</label>
      <label>☐ Intentar vender más que el stock (debe frenar)</label>
      <label>☐ Marcar encargo "listo" y cobrarlo en caja</label>
      <label>☐ Anular una venta y verificar el stock</label></div>
    <div class="chk"><b>Administrador</b>
      <label>☐ Crear producto con 3 fotos y categoría con emoji</label>
      <label>☐ Crear cliente y ver la ficha con su PIN</label>
      <label>☐ Pausar fiados y verificar el bloqueo en vivo</label>
      <label>☐ Exportar el reporte del día</label></div>
    <div class="chk"><b>Feedback</b>
      <label>☐ ¿Qué pantalla se siente lenta?</label>
      <label>☐ ¿Qué texto quedó chico o confuso?</label>
      <label>☐ ¿Qué les gustaría que haga y hoy no hace?</label>
      <label>☐ ¿Instalaron la app? ¿Cómo se ve en su Android?</label></div>
  </div>
  <p class="foot">Yapa · Kiosco Los Pinos · Guía interna del equipo — documento generado con capturas reales de la aplicación.</p>
</section>`)

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,sans-serif;color:#1f2430}
  .slide{width:1280px;height:720px;page-break-after:always;padding:52px 60px;position:relative;overflow:hidden;background:#fff}
  .kicker{color:#009DE0;font-size:13px;font-weight:800;letter-spacing:2.2px;margin-bottom:10px}
  h1{font-size:52px;line-height:1.08;letter-spacing:-1.5px}h1 em{color:#009DE0;font-style:normal}
  h2{font-size:34px;letter-spacing:-1px;margin-bottom:14px}
  .brand{color:#009DE0}
  .lead{font-size:19px;color:#4a5060;margin:18px 0 26px;line-height:1.5;max-width:520px}
  .lead2{font-size:17px;color:#4a5060;line-height:1.55;max-width:720px;margin-bottom:20px}
  .foot{position:absolute;bottom:26px;left:60px;font-size:12px;color:#98a0ad}
  /* portada */
  .cover{background:linear-gradient(135deg,#EBF7FD 0%,#fff 55%)}
  .cover-grid{display:flex;justify-content:space-between;align-items:center;height:600px}
  .logo-row{display:flex;align-items:center;gap:14px;margin-bottom:34px}
  .logo-mark{display:grid;place-items:center;width:56px;height:56px;border-radius:16px;background:#009DE0;color:#fff;font-size:34px;font-weight:900}
  .logo-name{font-size:40px;font-weight:800;letter-spacing:-1px}
  .chips{display:flex;gap:10px;flex-wrap:wrap}
  .chips span{background:#fff;border:1px solid #d8edf7;color:#007AB8;font-size:13px;font-weight:700;padding:8px 14px;border-radius:99px}
  .cover-shots{display:flex;gap:18px;transform:rotate(-2deg)}
  .cover-shots .phone:nth-child(2){transform:translateY(26px)}
  /* capturas */
  .row-shots{display:flex;gap:26px;margin-top:24px}
  .phone{flex:0 0 auto;width:220px;text-align:center}
  .phone img{width:100%;border-radius:18px;border:1px solid #e2e8f0;box-shadow:0 14px 34px rgba(15,60,90,.14)}
  .phone figcaption{font-size:12px;color:#7a8494;margin-top:8px}
  .cover .phone{width:225px}
  .split{display:flex;gap:34px;align-items:flex-start}
  .split .txt{flex:0 0 480px}
  .shots{display:flex;gap:18px;flex:1;min-width:0;align-items:flex-start}
  .shots .phone{width:200px}
  .shots.wide .phone{width:180px}
  .desk{flex:1;min-width:0;text-align:center}
  .desk img{width:100%;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 14px 34px rgba(15,60,90,.14)}
  .desk figcaption{font-size:12px;color:#7a8494;margin-top:8px}
  .feat{list-style:none;display:flex;flex-direction:column;gap:13px;font-size:15px;color:#39404e;line-height:1.5}
  .feat li{padding-left:22px;position:relative}
  .feat li:before{content:'●';color:#009DE0;position:absolute;left:0;font-size:11px;top:5px}
  .cards3{display:flex;gap:20px;margin:8px 0 4px}
  .card{flex:1;background:#F6FBFE;border:1px solid #dcefF8;border-radius:16px;padding:22px}
  .card b{font-size:17px;display:block;margin-bottom:8px}
  .card p{font-size:14px;color:#4a5060;line-height:1.5}
  .timeline{display:flex;flex-direction:column;gap:16px;max-width:880px;margin-top:8px}
  .step{display:flex;gap:16px;align-items:flex-start}
  .step i{flex:0 0 38px;height:38px;display:grid;place-items:center;background:#009DE0;color:#fff;border-radius:12px;font-style:normal;font-weight:800;font-size:17px}
  .step b{font-size:17px}
  .step p{font-size:14px;color:#4a5060;line-height:1.45;margin-top:2px}
  .tbl{border-collapse:collapse;width:100%;font-size:14.5px;margin-top:6px}
  .tbl th{background:#009DE0;color:#fff;padding:10px 14px;text-align:left;font-size:13.5px}
  .tbl th:first-child{background:#087da9}
  .tbl td{padding:9px 14px;border-bottom:1px solid #eef2f5}
  .tbl td:nth-child(n+2){text-align:center;font-weight:700;color:#0a9d58}
  .tbl tr:nth-child(even) td{background:#F8FBFD}
  .demo-box{margin-top:18px;background:#FFF8E6;border:1px solid #f3e2ac;border-radius:14px;padding:14px 18px;font-size:13.5px;color:#5c4d1e;line-height:1.55}
  .check-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:6px}
  .chk{background:#F8FAFC;border:1px solid #e6ebf0;border-radius:16px;padding:18px 20px}
  .chk b{display:block;font-size:16px;margin-bottom:10px;color:#007AB8}
  .chk label{display:block;font-size:14px;color:#39404e;padding:5px 0;cursor:default}
  @media print{.slide{page-break-after:always}}
</style></head><body>${slides.join('')}</body></html>`

writeFileSync('guia.html', html)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.goto(`file:///${process.cwd().replace(/\\/g, '/')}/guia.html`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1200))
await page.pdf({
  path: 'Guia_Completa_Yapa.pdf',
  width: '1280px',
  height: '720px',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
})
await browser.close()
console.log('Guia_Completa_Yapa.pdf generado ✔')
