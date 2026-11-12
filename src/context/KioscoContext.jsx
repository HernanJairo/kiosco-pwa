import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { buildSeed, CATEGORIAS } from './seedData'
import { firebaseLista } from '../services/firebase'
import * as fs from '../firebase/firestoreService'
import * as ops from './operaciones'
import { clientePorIdentificador } from '../utils/acceso'
import { normalizarFotos } from '../utils/imagen'
import { money } from '../utils/format'

const DB_KEY = 'kiosco_db_v2'
const SES_KEY = 'kiosco_session_v2'

// ==== Persistencia remota (Cloud Firestore, tiempo real) ====
// true → sincroniza con el proyecto kiosko-45709 vía onSnapshot +
// escrituras por documento (caché persistente nativa = modo offline).
// false → persiste solo en localStorage con seedData (modo demo local).
const USE_FIREBASE = true

const sleep = (ms = 160) => new Promise((r) => setTimeout(r, ms))
const clone = (o) => JSON.parse(JSON.stringify(o))
const uid = ops.uid

const KioscoContext = createContext(null)
// eslint-disable-next-line react/only-export-components
export const useKiosco = () => useContext(KioscoContext)

const ROLES_VALIDOS = ['cliente', 'vendedor', 'admin']

// Migración fotos[]: los productos viejos con `foto` única quedan con
// `fotos` normalizado y `foto` apuntando a la principal (retrocompat).
const normalizarDb = (d) => {
  if (Array.isArray(d?.productos)) d.productos = d.productos.map(normalizarFotos)
  return d
}

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const seed = buildSeed()
      // Rellena campos nuevos de config (whatsapp, aliasPago...) en bases viejas
      parsed.config = { ...seed.config, ...(parsed.config || {}) }
      if (!Array.isArray(parsed.clientes)) parsed.clientes = seed.clientes
      // Migración staff → personal: la colección vieja (usuario+clave)
      // se traduce a la nueva estructura (pin 4 dígitos, activo, foto).
      if (!Array.isArray(parsed.personal)) {
        parsed.personal =
          Array.isArray(parsed.staff) && parsed.staff.length
            ? parsed.staff.map((s) => ({
                id: s.id,
                usuario: s.usuario,
                nombre: s.nombre,
                apellido: s.apellido || '',
                rol: s.rol === 'admin' ? 'admin' : 'vendedor',
                pin: /^\d{4}$/.test(String(s.pin ?? s.clave ?? '')) ? String(s.pin ?? s.clave) : '1234',
                avatarUrl: s.avatarUrl || '',
                activo: s.activo !== false,
              }))
            : seed.personal
      }
      if (!Array.isArray(parsed.solicitudes)) parsed.solicitudes = []
      if (!Array.isArray(parsed.notificaciones)) parsed.notificaciones = []
      if (!Array.isArray(parsed.encargos)) parsed.encargos = []
      if (!Array.isArray(parsed.auditoria)) parsed.auditoria = []
      return normalizarDb(parsed)
    }
  } catch {
    /* datos corruptos: se regenera el seed */
  }
  return normalizarDb(buildSeed())
}
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SES_KEY))
    return s && ROLES_VALIDOS.includes(s.rol) ? s : null
  } catch {
    return null
  }
}

export function KioscoProvider({ children }) {
  const [db, setDb] = useState(loadDB)
  const [session, setSession] = useState(loadSession)
  const [toasts, setToasts] = useState([])
  const [remoto, setRemoto] = useState(false) // true si Firestore respondió

  useEffect(() => {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  }, [db])

  // Cola de notificaciones creadas localmente pendientes de subir a
  // Firestore (avisar las encola; el efecto de abajo las descarga).
  const colaNotifs = useRef([])

  // Sincronización en tiempo real con Firestore: cada colección vive en
  // una suscripción onSnapshot, así los cambios de otros dispositivos
  // (caja, admin, celular del cliente) aparecen sin recargar. Si la base
  // remota está vacía se siembra una única vez con el catálogo demo
  // (meta/semilla lo recuerda). Ante cualquier fallo queda el modo
  // local intacto como respaldo.
  useEffect(() => {
    if (!USE_FIREBASE || !firebaseLista) return
    let activo = true
    const offs = []
    ;(async () => {
      try {
        const sembrada = await fs.semillaSiVacio(buildSeed())
        if (sembrada) console.info('[firebase] Base inicializada con el catálogo demo.')
      } catch (e) {
        console.warn('[firebase] No se pudo verificar la semilla remota.', e)
      }
      if (!activo) return
      setRemoto(true)
      for (const col of fs.COLECCIONES_SUSCRIPTAS) {
        offs.push(
          fs.suscribir(col, (docs) => {
            setDb((prev) => {
              const n = clone(prev)
              n[col] = col === 'productos' ? docs.map(normalizarFotos) : docs
              return n
            })
          })
        )
      }
      offs.push(
        fs.suscribirConfig((data) => {
          setDb((prev) => {
            const n = clone(prev)
            n.config = { ...buildSeed().config, ...(data || {}) }
            return n
          })
        })
      )
    })()
    return () => {
      activo = false
      offs.forEach((off) => off())
    }
  }, [])

  // Sincronización best-effort con Firestore: nunca bloquea ni rompe la UI.
  const sync = (p) => {
    if (remoto) Promise.resolve(p).catch((e) => console.warn('[firebase] sync:', e))
  }

  // Descarga en Firestore las notificaciones creadas localmente (avisar
  // las encola en colaNotifs; las que llegan por onSnapshot no se
  // reescriben).
  useEffect(() => {
    if (!remoto || !colaNotifs.current.length) return
    const pendientes = colaNotifs.current.splice(0)
    for (const notif of pendientes) sync(fs.upsertNotificacion(notif))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.notificaciones, remoto])
  useEffect(() => {
    if (session) localStorage.setItem(SES_KEY, JSON.stringify(session))
    else localStorage.removeItem(SES_KEY)
  }, [session])

  const notify = (mensaje, tipo = 'success') => {
    const id = uid()
    setToasts((t) => [...t, { id, mensaje, tipo }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }

  const mutate = (fn) => setDb((prev) => { const n = clone(prev); fn(n); return n })

  // Registra un evento en el centro de notificaciones (campanita del
  // TopBar + panel de Actividad). `para` es 'staff', 'admin' o
  // 'cliente:<id>'; `cat` agrupa el feed del admin ('ventas', 'pedidos',
  // 'stock', 'clientes', 'caja'); `autor` deja firmada la acción para la
  // auditoría de sesión del vendedor.
  const avisar = (n, para, texto, tipo = 'info', cat = null, autor = null) => {
    if (!Array.isArray(n.notificaciones)) n.notificaciones = []
    const notif = { id: uid(), fecha: new Date().toISOString(), para, texto, tipo, cat, autor }
    n.notificaciones.unshift(notif)
    colaNotifs.current.push(notif)
    if (n.notificaciones.length > 200) n.notificaciones.length = 200
  }

  const avisarCliente = (n, cliente, texto, tipo) => avisar(n, `cliente:${cliente.id}`, texto, tipo)

  /* ================= AUTH ================= */
  // El cliente entra con DNI o correo electrónico (y también funciona el
  // teléfono) + PIN de 4 dígitos. La resolución del identificador vive en
  // utils/acceso.js para compartirla con el recupero de PIN.
  const loginCliente = async (ident, pin) => {
    await sleep()
    const c = clientePorIdentificador(db.clientes, ident)
    if (!c || c.pin !== String(pin).trim()) {
      throw new Error('DNI/correo o PIN incorrectos.')
    }
    const s = { rol: 'cliente', id: c.id, nombre: `${c.nombre} ${c.apellido}` }
    setSession(s)
    return s
  }

  // Acceso del mostrador: usuario (DNI o username) + PIN de 4 dígitos.
  const loginStaff = async (usuario, pin) => {
    await sleep()
    const u = ops.autenticarPersonal(db, { usuario, pin })
    const s = { rol: u.rol, id: u.id, nombre: `${u.nombre} ${u.apellido}`.trim() }
    setSession(s)
    return s
  }

  const logout = () => {
    setSession(null)
    notify('Sesión cerrada', 'info')
  }

  /* ================= PRODUCTOS ================= */
  const addProducto = async (data) => {
    await sleep()
    const p = normalizarFotos({ id: uid(), stockMin: 0, vencimiento: null, ...data })
    mutate((n) => n.productos.push(p))
    sync(fs.upsertProducto(p))
    return p
  }

  const updateProducto = async (id, patch) => {
    await sleep(90)
    mutate((n) => {
      const p = n.productos.find((x) => x.id === id)
      if (p) Object.assign(p, normalizarFotos({ ...p, ...patch }))
    })
    const p = db.productos.find((x) => x.id === id)
    if (p) sync(fs.upsertProducto(normalizarFotos({ ...p, ...patch })))
  }

  const deleteProducto = async (id) => {
    await sleep()
    mutate((n) => {
      n.productos = n.productos.filter((x) => x.id !== id)
    })
    sync(fs.borrarProducto(id))
  }

  // Stock Rápido: ajuste manual de unidades en mostrador (+N / −N).
  // Además de persistir, deja el movimiento firmado por el operador para
  // el feed del admin y la auditoría de sesión del vendedor.
  const ajustarStock = async (productoId, stockNuevo) => {
    await sleep(60)
    const antes = db.productos.find((x) => x.id === productoId)
    if (!antes) throw new Error('Producto no encontrado.')
    const nuevo = Math.max(0, Number(stockNuevo) || 0)
    const delta = nuevo - antes.stock
    mutate((n) => {
      const p = n.productos.find((x) => x.id === productoId)
      if (p) p.stock = nuevo
      avisar(
        n,
        'staff',
        nuevo === 0
          ? `Sin stock: ${antes.nombre} quedó agotado en mostrador.`
          : `Stock ${delta > 0 ? `+${delta}` : delta} · ${antes.nombre} · queda en ${nuevo} u.`,
        nuevo === 0 ? 'stock' : 'info',
        'stock',
        session?.nombre || 'mostrador'
      )
    })
    sync(fs.updateStock(productoId, nuevo))
  }

  /* ================= VENTAS / POS ================= */
  // Venta libre por defecto: efectivo y transferencia no exigen cliente.
  // Solo "cuenta corriente / fiado" requiere cliente con saldo o límite.
  const registrarVenta = async ({ items, metodo, clienteId = null, vendedor = 'mostrador', excepcionFiado = false, enEspera = false, retiradoPor = null, reservado = false }) => {
    await sleep(220)
    if (!db.config.abierto) throw new Error('Kiosco cerrado: no se pueden registrar ventas.')
    const { detalle, total, cliente } = ops.validarVenta(db, { items, metodo, clienteId, excepcionFiado, omitirStock: reservado })

    const venta = {
      id: uid(),
      fecha: new Date().toISOString(),
      items: detalle,
      total,
      metodo,
      clienteId: cliente?.id ?? null,
      clienteNombre: cliente ? `${cliente.nombre} ${cliente.apellido}` : null,
      vendedor,
      anulada: false,
      // 'completada' por defecto; 'en_espera_transferencia' cuando el
      // mostrador guarda el ticket aguardando que impacte el pago.
      estado: enEspera ? 'en_espera_transferencia' : 'completada',
      // Quién retiró físicamente la bolsa cuando la venta cierra un
      // encargo (titular o tercero autorizado): queda en el movimiento.
      retiradoPor: retiradoPor || null,
    }

    let productosSync = []
    let clienteSync = null
    mutate((n) => {
      ops.aplicarVentaDb(n, { venta, detalle, metodo, clienteId: cliente?.id, descontarStock: !reservado })
      // Documentos mutados que viajan a Firestore (stock descontado y
      // saldo/fiado/movimientos del cliente).
      productosSync = detalle
        .map((d) => n.productos.find((x) => x.id === d.productoId))
        .filter(Boolean)
      if (cliente) clienteSync = n.clientes.find((x) => x.id === cliente.id) || null
      // Feed del admin: cada venta queda asentada con su autor de turno.
      avisar(
        n,
        'staff',
        `Venta ${enEspera ? 'en espera ' : ''}· ${money(total)} · ${detalle.reduce((s, d) => s + d.cantidad, 0)} ítem(s)${cliente ? ` · ${venta.clienteNombre}` : ''}.`,
        'venta',
        'ventas',
        vendedor
      )
      if (cliente && metodo === 'fiado') {
        const c = n.clientes.find((x) => x.id === cliente.id)
        avisarCliente(
          n,
          c,
          `Compra en cuenta corriente por ${money(total)} (${detalle.reduce((s, d) => s + d.cantidad, 0)} ítem(s)).`,
          'consumo'
        )
      }
      // Regla antifraude: tras cada compra concreta se evalúa el
      // desbloqueo automático de la Cuenta Corriente (una sola vez).
      if (cliente && !enEspera) {
        const des = ops.desbloquearFiadoDb(n, cliente.id)
        if (des) {
          avisarCliente(
            n,
            des.cliente,
            `¡Buenas noticias! Ya tenés la Cuenta Corriente habilitada con un límite de ${money(des.limite)}.`,
            'acreditada'
          )
          avisar(
            n,
            'admin',
            `Cta. Corriente desbloqueada automáticamente para ${des.cliente.nombre} ${des.cliente.apellido} · límite inicial ${money(des.limite)}.`,
            'acreditada',
            'clientes',
            'regla automática'
          )
          avisar(
            n,
            'staff',
            `Cta. Corriente desbloqueada para ${des.cliente.nombre} ${des.cliente.apellido} (cumplió compras y monto mínimos).`,
            'acreditada',
            'clientes',
            'regla automática'
          )
        }
      }
    })
    sync(fs.registrarVenta(venta))
    if (!reservado) for (const p of productosSync) sync(fs.upsertProducto(p))
    if (clienteSync) sync(fs.updateCliente(clienteSync.id, clienteSync))
    return venta
  }

  // Aprueba una venta guardada "en espera" por transferencia: el pago ya
  // ingresó. El stock se descontó preventivamente al registrarla, así que
  // acá solo cambia el estado. Para cancelarla se usa anularVenta, que
  // restaura el stock.
  const aprobarCobroEspera = async (ventaId) => {
    await sleep(90)
    const venta = db.ventas.find((v) => v.id === ventaId)
    if (!venta || venta.anulada || venta.estado !== 'en_espera_transferencia') {
      throw new Error('La operación ya no está en espera.')
    }
    mutate((n) => {
      const v = n.ventas.find((x) => x.id === ventaId)
      if (v) v.estado = 'completada'
    })
    sync(fs.registrarVenta({ ...venta, estado: 'completada' }))
  }

  const anularVenta = async (ventaId) => {
    await sleep()
    const venta = db.ventas.find((v) => v.id === ventaId)
    if (!venta) throw new Error('Venta no encontrada.')
    let productosSync = []
    let clienteSync = null
    mutate((n) => {
      ops.anularVentaDb(n, ventaId)
      // Stock restaurado y posible reversa de saldo/fiado del cliente.
      productosSync = venta.items
        .map((i) => n.productos.find((x) => x.id === i.productoId))
        .filter(Boolean)
      if (venta.clienteId) clienteSync = n.clientes.find((x) => x.id === venta.clienteId) || null
    })
    sync(fs.registrarVenta({ ...venta, anulada: true }))
    for (const p of productosSync) sync(fs.upsertProducto(p))
    if (clienteSync) sync(fs.updateCliente(clienteSync.id, clienteSync))
  }

  /* ================= CLIENTES ================= */
  // Alta de cliente: sirve para el alta administrativa del mostrador y
  // para el auto-registro público. El DNI es único en todo el sistema.
  const crearCliente = async ({ nombre, apellido, dni, telefono = '', email = '', pin, limiteFiado = 0 }) => {
    await sleep()
    const datos = { nombre, apellido, dni, telefono, email, pin, limiteFiado }
    ops.validarAltaCliente(db.clientes, datos)
    const cliente = ops.nuevoCliente(datos)
    mutate((n) => {
      // Revalida sobre el borrador por si otro alta corrió en paralelo.
      ops.validarAltaCliente(n.clientes, datos)
      n.clientes.push(cliente)
      // El alta queda firmada por quien la registró (mostrador o
      // auto-registro público) para la auditoría de actividad.
      avisar(
        n,
        'staff',
        `Nuevo cliente: ${cliente.nombre} ${cliente.apellido} · DNI ${cliente.dni}.`,
        'info',
        'clientes',
        session?.nombre || 'registro público'
      )
    })
    sync(fs.updateCliente(cliente.id, cliente))
    return { cliente }
  }

  // Regla de integridad: no se puede eliminar un cliente con deuda > 0.
  const eliminarCliente = async (clienteId) => {
    await sleep()
    const eliminado = ops.eliminarClienteDb(clone(db), clienteId) // valida antes de mutar
    let descartadas = []
    mutate((n) => {
      ops.eliminarClienteDb(n, clienteId)
      // Las solicitudes pendientes que se descartaron en el borrador
      // también deben subirse: si no, onSnapshot las "resucita" en la
      // bandeja aunque el cliente ya no exista.
      descartadas = (n.solicitudes || []).filter(
        (s) => s.clienteId === clienteId && s.estado === 'descartada'
      )
    })
    sync(fs.borrarCliente(clienteId))
    for (const s of descartadas) sync(fs.upsertSolicitud(s))
    return eliminado
  }

  // Perfil del cliente: avatar, teléfono, límite propio de fiado, etc.
  const updateCliente = async (clienteId, patch) => {
    await sleep(90)
    if (patch?.pin !== undefined && !/^\d{4}$/.test(String(patch.pin).trim())) {
      throw new Error('El PIN debe tener exactamente 4 dígitos.')
    }
    mutate((n) => {
      const c = n.clientes.find((x) => x.id === clienteId)
      if (c) Object.assign(c, patch)
    })
    sync(fs.updateCliente(clienteId, patch))
  }

  // Restablecimiento directo del PIN (mostrador): asigna el temporal.
  const resetearPinCliente = async (clienteId, pin = ops.PIN_TEMPORAL) => {
    await sleep(90)
    if (!/^\d{4}$/.test(String(pin))) throw new Error('El PIN temporal debe tener 4 dígitos.')
    const c = db.clientes.find((x) => x.id === clienteId)
    if (!c) throw new Error('Cliente no encontrado.')
    let clienteSync = null
    mutate((n) => {
      const x = n.clientes.find((i) => i.id === clienteId)
      if (!x) return
      x.pin = pin
      x.movimientos.unshift({
        id: uid(),
        fecha: new Date().toISOString(),
        tipo: 'seguridad',
        detalle: `PIN restablecido por el kiosco · temporal ${pin}`,
        monto: 0,
      })
      avisarCliente(n, x, `Tu PIN fue restablecido por el kiosco. Clave temporal: ${pin}.`, 'seguridad')
      clienteSync = x
    })
    if (clienteSync) sync(fs.updateCliente(clienteId, clienteSync))
    return pin
  }

  /* ================= LIBRETA / PAGOS ================= */
  const registrarPago = async (clienteId, monto, origen = 'kiosco') => {
    await sleep()
    monto = Number(monto)
    if (!monto || monto <= 0) throw new Error('Ingresá un monto válido.')
    // El pago en efectivo auto-registrado por el cliente está bloqueado:
    // ese origen solo puede informar transferencias pendientes.
    if (origen === 'cliente') {
      throw new Error('El pago en efectivo solo se recibe en el mostrador. Informá una transferencia.')
    }
    const cliente = db.clientes.find((c) => c.id === clienteId)
    if (!cliente) throw new Error('Cliente no encontrado.')

    const detalle = origen === 'acreditacion' ? 'Transferencia acreditada' : 'Registrado en kiosco'
    let clienteSync = null
    mutate((n) => {
      const { cliente: c } = ops.aplicarPagoDb(n, clienteId, monto, detalle)
      clienteSync = c
      if (origen === 'kiosco') {
        avisarCliente(n, c, `Pago de ${money(monto)} registrado en el kiosco.`, 'acreditada')
        avisar(n, 'staff', `Pago de deuda · ${money(monto)} · ${c.nombre} ${c.apellido}.`, 'acreditada', 'clientes', session?.nombre || 'mostrador')
      }
    })
    // El doc del cliente lleva saldo, fiados y movimientos juntos.
    if (clienteSync) sync(fs.updateCliente(clienteId, clienteSync))
  }

  const recargarSaldo = async (clienteId, monto, origen = 'kiosco') => {
    await sleep()
    monto = Number(monto)
    if (!monto || monto <= 0) throw new Error('Ingresá un monto válido.')
    const cliente = db.clientes.find((c) => c.id === clienteId)
    if (!cliente) throw new Error('Cliente no encontrado.')
    const detalle = origen === 'acreditacion' ? 'Transferencia acreditada' : 'Kiosco'
    let clienteSync = null
    mutate((n) => {
      const { cliente: c } = ops.aplicarRecargaDb(n, clienteId, monto, detalle)
      clienteSync = c
      if (origen === 'kiosco') {
        avisarCliente(n, c, `Recarga de ${money(monto)} acreditada en tu billetera.`, 'acreditada')
        avisar(n, 'staff', `Recarga de saldo · ${money(monto)} · ${c.nombre} ${c.apellido}.`, 'acreditada', 'clientes', session?.nombre || 'mostrador')
      }
    })
    if (clienteSync) sync(fs.updateCliente(clienteId, clienteSync))
  }

  /* ================= SOLICITUDES ================= */
  // El cliente informa una transferencia desde su billetera: queda
  // pendiente en la bandeja hasta que el mostrador la valide.
  const solicitarTransferencia = async ({ clienteId, monto, origen = 'cliente', tipoOperacion = 'deuda' }) => {
    await sleep()
    const solicitud = ops.nuevaSolicitudTransferencia(db, { clienteId, monto, origen, tipoOperacion })
    mutate((n) => {
      n.solicitudes.unshift(solicitud)
      avisar(
        n,
        'staff',
        `${solicitud.nombre} informó una transferencia de ${money(solicitud.monto)} (${tipoOperacion === 'recarga' ? 'recarga de saldo' : 'pago de deuda'}) para acreditar.`,
        'pago'
      )
    })
    sync(fs.upsertSolicitud(solicitud))
    return solicitud
  }

  // "¿Olvidaste tu PIN?" del login público: si el DNI existe se registra
  // una solicitud RESET_PIN pendiente (sin duplicar pedidos abiertos) y
  // se avisa al mostrador por la campana.
  const solicitarResetPin = async (dni) => {
    await sleep()
    const res = ops.nuevaSolicitudResetPin(db, { dni })
    if (!res) throw new Error('No encontramos ningún cliente registrado con ese DNI.')
    if (!res.duplicada) {
      mutate((n) => {
        n.solicitudes.unshift(res.solicitud)
        avisar(n, 'staff', `${res.cliente.nombre} ${res.cliente.apellido} pidió restablecer su PIN (DNI ${res.cliente.dni}).`, 'seguridad')
      })
      sync(fs.upsertSolicitud(res.solicitud))
    }
    return res.solicitud
  }

  // Aprueba la solicitud: RESET_PIN → clave temporal; TRANSFERENCIA →
  // impacta el saldo/deuda del cliente de inmediato.
  const aprobarSolicitud = async (solicitudId) => {
    await sleep(90)
    let resultado
    mutate((n) => {
      resultado = ops.aprobarSolicitudDb(n, solicitudId)
      const { solicitud: s, cliente: c } = resultado
      if (s.tipo === 'RESET_PIN') {
        avisarCliente(n, c, `Tu PIN fue restablecido por el kiosco. Clave temporal: ${c.pin}.`, 'seguridad')
      } else {
        avisarCliente(n, c, `Transferencia de ${money(s.monto)} acreditada a tu cuenta.`, 'acreditada')
      }
    })
    if (resultado?.solicitud) {
      sync(fs.upsertSolicitud(resultado.solicitud))
      // El cliente muta en ambos caminos (PIN temporal o saldo/fiados):
      // se sube el documento completo para no perder movimientos.
      sync(fs.updateCliente(resultado.cliente.id, resultado.cliente))
    }
    return resultado
  }

  const descartarSolicitud = async (solicitudId) => {
    await sleep(90)
    const s = db.solicitudes.find((x) => x.id === solicitudId)
    const cliente = s && db.clientes.find((c) => c.id === s.clienteId)
    mutate((n) => {
      ops.descartarSolicitudDb(n, solicitudId)
      if (s && cliente) {
        const c = n.clientes.find((x) => x.id === s.clienteId)
        avisarCliente(
          n,
          c,
          s.tipo === 'RESET_PIN'
            ? 'Tu pedido de restablecimiento de PIN fue descartado por el kiosco.'
            : `La transferencia de ${money(s.monto)} que informaste fue rechazada.`,
          'rechazada'
        )
      }
    })
    if (s) sync(fs.upsertSolicitud({ ...s, estado: 'descartada' }))
  }

  /* ================= PERSONAL / EQUIPO ================= */
  // Alta de integrante (admin o vendedor) desde "Equipo y Permisos".
  const addPersonal = async (datos) => {
    await sleep()
    ops.validarAltaPersonal(db.personal, datos)
    const u = ops.nuevoPersonal(datos)
    mutate((n) => {
      ops.validarAltaPersonal(n.personal, datos) // revalida sobre el borrador
      n.personal.push(u)
    })
    sync(fs.upsertPersonal(u))
    return u
  }

  // Edición administrativa: datos, rol, estado activo, restablecer PIN.
  // Si el que se edita es el usuario logueado, su nombre visible se
  // refresca en la sesión.
  const updatePersonal = async (id, patch) => {
    await sleep(90)
    let actualizado
    mutate((n) => {
      actualizado = ops.actualizarPersonalDb(n, id, patch)
    })
    if (session?.id === id && session?.rol !== 'cliente' && actualizado) {
      setSession((s) => ({ ...s, nombre: `${actualizado.nombre} ${actualizado.apellido}`.trim(), rol: actualizado.rol }))
    }
    if (actualizado) sync(fs.upsertPersonal(actualizado))
    return actualizado
  }

  const eliminarPersonal = async (id) => {
    await sleep()
    ops.eliminarPersonalDb(clone(db), id) // valida antes de mutar (último admin)
    mutate((n) => ops.eliminarPersonalDb(n, id))
    sync(fs.borrarPersonal(id))
  }

  // Cambio de PIN propio desde "Mi Perfil": exige el PIN vigente.
  const cambiarPinPersonal = async (id, pinActual, pinNuevo) => {
    await sleep(90)
    let actualizado = null
    mutate((n) => {
      actualizado = ops.cambiarPinPersonalDb(n, id, pinActual, pinNuevo)
    })
    if (actualizado) sync(fs.upsertPersonal(actualizado))
  }

  /* ================= ENCARGOS (retiro en local) =================
     El cliente logueado envía su carrito "para armar" sin pagar aún.
     El staff lo prepara, lo marca listo y el cliente lo retira en caja
     mostrando su QR; el cobro se registra como venta normal. */
  const enviarEncargo = async (items, retiroTercero = null) => {
    await sleep(120)
    if (!clienteSesion) throw new Error('Tenés que iniciar sesión para encargar.')
    if (!config.recibiendoEncargos || config.encargosActivos === false) {
      throw new Error('Los encargos están pausados temporalmente.')
    }
    let creado = null
    let productosSync = []
    mutate((n) => {
      creado = ops.nuevoEncargo(n, { clienteId: clienteSesion.id, items, retiroTercero })
      // El encargo reserva stock: los productos descontados también viajan.
      productosSync = creado.items
        .map((i) => n.productos.find((x) => x.id === i.productoId))
        .filter(Boolean)
      avisar(
        n,
        'staff',
        `Nuevo encargo de ${creado.clienteNombre} · ${creado.items.reduce((s, i) => s + i.cantidad, 0)} ítem(s) · ${money(creado.total)}.`,
        'encargo',
        'pedidos',
        creado.clienteNombre
      )
    })
    if (creado) {
      sync(fs.upsertEncargo(creado))
      for (const p of productosSync) sync(fs.upsertProducto(p))
    }
    return creado
  }

  // Ajuste por faltante de góndola ("caso 999"): vendedor y admin pueden
  // quitar ítems del pedido; el stock reservado vuelve a la góndola.
  const ajustarItemEncargo = async (encargoId, productoId, cantidadQuitar) => {
    await sleep(60)
    let e = null
    let productoSync = null
    mutate((n) => {
      e = ops.ajustarItemEncargoDb(n, encargoId, productoId, cantidadQuitar, { ajustadoPor: session?.nombre })
      productoSync = n.productos.find((x) => x.id === productoId) || null
      const item = (e.itemsFaltantes || []).find((f) => f.productoId === productoId)
      avisar(
        n,
        'staff',
        `Encargo #${e.id.slice(0, 8).toUpperCase()} ajustado por faltante · −${cantidadQuitar}× ${item?.nombre || 'ítem'} (${e.clienteNombre}).`,
        'encargo',
        'pedidos',
        session?.nombre || 'mostrador'
      )
    })
    if (e) {
      sync(fs.upsertEncargo(e))
      // El faltante devuelve la reserva a la góndola.
      if (productoSync) sync(fs.upsertProducto(productoSync))
    }
    return e
  }

  const guardarTerceroEncargo = async (encargoId, datos) => {
    await sleep(60)
    let e = null
    mutate((n) => {
      e = ops.guardarTerceroEncargoDb(n, encargoId, datos)
    })
    if (e) sync(fs.upsertEncargo(e))
    return e
  }

  const marcarEncargoListo = async (encargoId) => {
    await sleep(90)
    let e = null
    mutate((n) => {
      e = ops.marcarEncargoListoDb(n, encargoId, { preparadoPor: session?.nombre || 'mostrador' })
      avisar(
        n,
        'staff',
        `Encargo #${e.id.slice(0, 8).toUpperCase()} listo para retirar · ${e.clienteNombre} · ${money(e.total)}.`,
        'encargo',
        'pedidos',
        session?.nombre || 'mostrador'
      )
      const cliente = n.clientes.find((c) => c.id === e.clienteId)
      if (cliente) {
        const falt = (e.itemsFaltantes || []).map((f) => `${f.cantidad}× ${f.nombre}`).join(', ')
        avisarCliente(
          n,
          cliente,
          `¡Tu pedido #${e.id.slice(0, 8).toUpperCase()} está listo para retirar en caja! Total a pagar ${money(e.total)}.` +
            (falt ? ` Sin stock en góndola se descontó: ${falt}.` : ''),
          'encargo'
        )
      }
    })
    if (e) sync(fs.upsertEncargo(e))
    return e
  }

  // El mostrador lo cierra al cobrar el pedido (venta normal asociada).
  const entregarEncargo = async (encargoId, retiradoPor = null) => {
    await sleep(60)
    let e = null
    mutate((n) => {
      e = ops.entregarEncargoDb(n, encargoId, { retiradoPor })
      avisar(
        n,
        'staff',
        `Encargo #${e.id.slice(0, 8).toUpperCase()} entregado · retiró ${e.retiradoPor}.`,
        'encargo',
        'pedidos',
        session?.nombre || 'mostrador'
      )
      const cliente = n.clientes.find((c) => c.id === e.clienteId)
      if (cliente) {
        avisarCliente(
          n,
          cliente,
          `Retiraste tu pedido #${e.id.slice(0, 8).toUpperCase()}. ¡Gracias por elegir ${n.config.nombreKiosco}!`,
          'encargo'
        )
      }
    })
    if (e) sync(fs.upsertEncargo(e))
    return e
  }

  const cancelarEncargo = async (encargoId) => {
    await sleep(60)
    let e = null
    let productosSync = []
    mutate((n) => {
      e = ops.cancelarEncargoDb(n, encargoId)
      // La mercadería reservada vuelve a la góndola.
      productosSync = e.items
        .map((i) => n.productos.find((x) => x.id === i.productoId))
        .filter(Boolean)
      avisar(
        n,
        'staff',
        `Encargo #${e.id.slice(0, 8).toUpperCase()} cancelado (${e.clienteNombre}) · mercadería devuelta a stock.`,
        'encargo',
        'pedidos',
        session?.nombre || 'mostrador'
      )
      const cliente = n.clientes.find((c) => c.id === e.clienteId)
      if (cliente) {
        avisarCliente(
          n,
          cliente,
          `Tu encargo #${e.id.slice(0, 8).toUpperCase()} fue cancelado por el kiosco.`,
          'encargo'
        )
      }
    })
    if (e) {
      sync(fs.upsertEncargo(e))
      for (const p of productosSync) sync(fs.upsertProducto(p))
    }
    return e
  }

  /* ================= CONFIG ================= */
  const updateConfig = async (patch) => {
    await sleep()
    const abre = patch?.abierto === true && !db.config.abierto
    // Cambios auditables: cada toggle de estado operativo deja registro
    // con autor/rol/hora y le avisa a la administración.
    const auditables = [
      ['abierto', 'Local abierto', 'Local cerrado'],
      ['recibiendoEncargos', 'Encargos habilitados', 'Encargos pausados'],
      ['fiadosActivos', 'Fiados habilitados', 'Fiados pausados'],
      ['encargosActivos', 'Pedidos de encargo habilitados', 'Pedidos de encargo pausados'],
    ]
    mutate((n) => {
      Object.assign(n.config, patch)
      for (const [clave, onTxt, offTxt] of auditables) {
        if (patch?.[clave] === undefined || patch[clave] === db.config[clave]) continue
        const texto = patch[clave] ? onTxt : offTxt
        ops.registrarAuditoriaDb(n, {
          autor: session?.nombre || 'mostrador',
          rol: session?.rol || 'sistema',
          accion: `ESTADO_${clave.toUpperCase()}`,
          detalle: `${texto} · ${n.config.nombreKiosco}`,
        })
        // La administración y el mostrador se enteran por la campanita.
        avisar(n, 'admin', `${texto}: ${session?.nombre || 'mostrador'} (${session?.rol || '?'}) lo cambió.`, 'auditoria', 'caja', session?.nombre || 'mostrador')
        avisar(n, 'staff', `${texto} — por ${session?.nombre || 'mostrador'}.`, 'auditoria', 'caja', session?.nombre || 'mostrador')
      }
      // Apertura de caja: el mostrador se entera por la campanita.
      if (abre) avisar(n, 'staff', 'Apertura de caja: el kiosco habilitó el mostrador.', 'apertura', 'caja', session?.nombre || 'mostrador')
    })
    sync(fs.updateConfigDoc(patch))
  }

  const resetDemo = async () => {
    await sleep(200)
    setDb(buildSeed())
    setSession(null)
    notify('Datos de demostración restablecidos.', 'info')
  }

  const clienteSesion =
    session?.rol === 'cliente' ? db.clientes.find((c) => c.id === session.id) || null : null

  const solicitudesPendientes = ops.solicitudesPendientesDe(db)

  // Categorías base + las que ya existan en productos (creadas al vuelo)
  const categorias = [
    ...new Set([...CATEGORIAS, ...db.productos.map((p) => p.categoria).filter(Boolean)]),
  ]

  const value = {
    db,
    config: db.config,
    productos: db.productos,
    clientes: db.clientes,
    personal: db.personal,
    ventas: db.ventas,
    solicitudes: db.solicitudes,
    solicitudesPendientes,
    encargos: db.encargos || [],
    auditoria: db.auditoria || [],
    notificaciones: db.notificaciones || [],
    session,
    clienteSesion,
    categorias,
    notify,
    loginCliente,
    loginStaff,
    logout,
    addProducto,
    updateProducto,
    deleteProducto,
    ajustarStock,
    registrarVenta,
    aprobarCobroEspera,
    anularVenta,
    crearCliente,
    eliminarCliente,
    updateCliente,
    resetearPinCliente,
    registrarPago,
    recargarSaldo,
    solicitarTransferencia,
    solicitarResetPin,
    aprobarSolicitud,
    descartarSolicitud,
    persistencia: { modo: remoto ? 'firebase' : 'local', remoto, useFirebase: USE_FIREBASE },
    enviarEncargo,
    ajustarItemEncargo,
    guardarTerceroEncargo,
    marcarEncargoListo,
    entregarEncargo,
    cancelarEncargo,
    addPersonal,
    updatePersonal,
    eliminarPersonal,
    cambiarPinPersonal,
    updateConfig,
    resetDemo,
  }

  const TOAST_STYLE = {
    success: ['bg-emerald-600', CheckCircle2],
    error: ['bg-rose-600', XCircle],
    warn: ['bg-amber-500', AlertTriangle],
    info: ['bg-indigo-600', Info],
  }

  return (
    <KioscoContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-72 flex-col gap-2">
        {toasts.map((t) => {
          const [bg, Icon] = TOAST_STYLE[t.tipo] || TOAST_STYLE.info
          return (
            <div
              key={t.id}
              className={`toast-in flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${bg}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <span>{t.mensaje}</span>
            </div>
          )
        })}
      </div>
    </KioscoContext.Provider>
  )
}
