import { createContext, useContext, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { buildSeed, CATEGORIAS } from './seedData'
import { firebaseLista } from '../firebase/firebaseConfig'
import * as fs from '../firebase/firestoreService'
import { telefonoInternacional } from '../utils/whatsapp'
import { tutorExistente, tutorPorIdentificador } from '../utils/acceso'
import { money } from '../utils/format'

const DB_KEY = 'kiosco_db_v1'
const SES_KEY = 'kiosco_session_v1'

// ==== Persistencia remota (opcional, plug & play) ====
// true → intenta sincronizar con Firestore cuando las credenciales de
// firebaseConfig.js estén cargadas y el SDK instalado (npm i firebase).
// false (por defecto, demo) → persiste solo en localStorage con seedData.
const USE_FIREBASE = false

const sleep = (ms = 160) => new Promise((r) => setTimeout(r, ms))
const clone = (o) => JSON.parse(JSON.stringify(o))
const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)

const KioscoContext = createContext(null)
// eslint-disable-next-line react/only-export-components
export const useKiosco = () => useContext(KioscoContext)

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const seed = buildSeed()
      // Rellena campos nuevos de config (whatsapp, aliasPago...) en bases viejas
      parsed.config = { ...seed.config, ...(parsed.config || {}) }
      if (!Array.isArray(parsed.staff)) parsed.staff = seed.staff
      if (!Array.isArray(parsed.pagosPendientes)) parsed.pagosPendientes = []
      if (!Array.isArray(parsed.notificaciones)) parsed.notificaciones = []
      return parsed
    }
  } catch {
    /* datos corruptos: se regenera el seed */
  }
  return buildSeed()
}
function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SES_KEY))
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

  // Arranque remoto: si Firebase está habilitado y configurado, hidrata
  // productos y clientes desde Firestore. Ante cualquier fallo queda el
  // contenido local intacto (fallback seguro para la demo).
  useEffect(() => {
    if (!USE_FIREBASE || !firebaseLista) return
    let activo = true
    ;(async () => {
      try {
        const [productos, clientes] = await Promise.all([fs.getProductos(), fs.getClientes()])
        if (!activo || (!productos && !clientes)) return
        setRemoto(true)
        setDb((prev) => {
          const n = clone(prev)
          if (productos?.length) n.productos = productos
          if (clientes?.length) n.alumnos = clientes
          return n
        })
      } catch (e) {
        console.warn('[firebase] Sin conexión remota, sigo en modo local.', e)
      }
    })()
    return () => {
      activo = false
    }
  }, [])

  // Sincronización best-effort con Firestore: nunca bloquea ni rompe la UI.
  const sync = (p) => {
    if (remoto) Promise.resolve(p).catch((e) => console.warn('[firebase] sync:', e))
  }
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
  // TopBar). `para` es 'staff' o '<rol>:<id>' (p.ej. 'tutor:t1'); el feed
  // se filtra según la sesión activa.
  const avisar = (n, para, texto, tipo = 'info') => {
    if (!Array.isArray(n.notificaciones)) n.notificaciones = []
    n.notificaciones.unshift({ id: uid(), fecha: new Date().toISOString(), para, texto, tipo })
    if (n.notificaciones.length > 200) n.notificaciones.length = 200
  }

  // Avisa al alumno y a su tutor (si tiene) en una sola pasada.
  const avisarFamilia = (n, alumno, texto, tipo) => {
    avisar(n, `alumno:${alumno.id}`, texto, tipo)
    if (alumno.tutorId) avisar(n, `tutor:${alumno.tutorId}`, texto, tipo)
  }

  // Aplica un abono a los fiados más antiguos del alumno (in-place) y
  // devuelve { resto, abonado }. Compartida por registrarPago/recargarSaldo
  // y por el cálculo de saldo resultante para la sincronización remota.
  const abonarFiados = (a, monto) => {
    let resto = monto
    let abonado = 0
    const pendientes = [...a.fiados]
      .filter((f) => !f.pagado && f.pendiente > 0)
      .sort((x, y) => new Date(x.fecha) - new Date(y.fecha))
    for (const f of pendientes) {
      if (resto <= 0) break
      const pago = Math.min(resto, f.pendiente)
      f.pendiente -= pago
      f.pagado = f.pendiente <= 0.009
      if (f.pagado) f.pendiente = 0
      resto -= pago
      abonado += pago
    }
    a.deuda = a.fiados.reduce((s, f) => s + f.pendiente, 0)
    if (resto > 0) a.saldo += resto
    return { resto, abonado }
  }

  /* ================= AUTH ================= */
  const loginAlumno = async (dni, pin) => {
    await sleep()
    const a = db.alumnos.find(
      (x) => x.dni === String(dni).trim() && x.pin === String(pin).trim()
    )
    if (!a) throw new Error('DNI o PIN incorrectos.')
    const s = { rol: 'alumno', id: a.id, nombre: `${a.nombre} ${a.apellido}` }
    setSession(s)
    return s
  }

  // El tutor se identifica con DNI, usuario (teléfono normalizado de su
  // alta automática) o teléfono en cualquier formato.
  const loginTutor = async (ident, pin) => {
    await sleep()
    const t = tutorPorIdentificador(db.tutores, ident)
    if (!t || t.pin !== String(pin).trim()) throw new Error('Usuario o PIN incorrectos.')
    const s = { rol: 'tutor', id: t.id, nombre: t.nombre }
    setSession(s)
    return s
  }

  const loginStaff = async (usuario, clave) => {
    await sleep()
    const u = db.staff.find(
      (x) => x.usuario === String(usuario).trim().toLowerCase() && x.clave === String(clave)
    )
    if (!u) throw new Error('Usuario o contraseña incorrectos.')
    const s = { rol: u.rol, id: u.id, nombre: u.nombre }
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
    const p = { id: uid(), stockMin: 0, vencimiento: null, ...data }
    mutate((n) => n.productos.push(p))
    sync(fs.upsertProducto(p))
    return p
  }

  const updateProducto = async (id, patch) => {
    await sleep(90)
    mutate((n) => {
      const p = n.productos.find((x) => x.id === id)
      if (p) Object.assign(p, patch)
    })
    const p = db.productos.find((x) => x.id === id)
    if (p) sync(fs.upsertProducto({ ...p, ...patch }))
  }

  const deleteProducto = async (id) => {
    await sleep()
    mutate((n) => {
      n.productos = n.productos.filter((x) => x.id !== id)
    })
  }

  /* ================= VENTAS / POS ================= */
  const registrarVenta = async ({ items, metodo, alumnoId = null, vendedor = 'mostrador', excepcionFiado = false, enEspera = false }) => {
    await sleep(220)
    if (!db.config.abierto) throw new Error('Kiosco cerrado: no se pueden registrar ventas.')
    if (!items?.length) throw new Error('El carrito está vacío.')

    // Consolida cantidades por productoId: dos líneas del mismo ítem no deben
    // pasar individualmente el control de stock.
    const porProducto = new Map()
    for (const it of items) {
      porProducto.set(it.productoId, (porProducto.get(it.productoId) || 0) + Number(it.cantidad || 0))
    }
    const detalle = []
    let total = 0
    for (const [productoId, cantidad] of porProducto) {
      const p = db.productos.find((x) => x.id === productoId)
      if (!p) throw new Error('Producto no encontrado.')
      if (cantidad < 1) throw new Error('Cantidad inválida.')
      if (p.stock < cantidad) throw new Error(`Stock insuficiente: ${p.nombre}.`)
      detalle.push({ productoId: p.id, nombre: p.nombre, cantidad, precio: p.precio, costo: p.costo })
      total += p.precio * cantidad
    }

    // El alumno es opcional en ventas de contado (asociar solo deja
    // constancia en su historial); solo el fiado lo exige.
    let alumno = null
    if (alumnoId) alumno = db.alumnos.find((a) => a.id === alumnoId) || null
    if (metodo === 'fiado') {
      if (!alumno) throw new Error('Seleccioná un alumno válido para fiar.')
      const limite = Number(db.config.limiteFiadoGlobal) || 0
      const deudaProyectada = alumno.deuda + total
      if (!excepcionFiado && limite > 0 && deudaProyectada > limite) {
        const err = new Error(
          `Límite de fiado global superado: ${alumno.nombre} quedaría debiendo $ ${deudaProyectada.toLocaleString('es-AR')} (límite $ ${limite.toLocaleString('es-AR')}).`
        )
        err.code = 'FIADO_LIMITE'
        err.deudaProyectada = deudaProyectada
        throw err
      }
    }

    const venta = {
      id: uid(),
      fecha: new Date().toISOString(),
      items: detalle,
      total,
      metodo,
      alumnoId: alumno?.id ?? null,
      alumnoNombre: alumno ? `${alumno.nombre} ${alumno.apellido}` : null,
      vendedor,
      anulada: false,
      // 'completada' por defecto; 'en_espera_transferencia' cuando el
      // mostrador guarda el ticket aguardando que impacte el pago.
      estado: enEspera ? 'en_espera_transferencia' : 'completada',
    }

    mutate((n) => {
      for (const it of detalle) {
        const p = n.productos.find((x) => x.id === it.productoId)
        if (!p || p.stock - it.cantidad < 0) throw new Error(`Stock insuficiente: ${it.nombre}.`)
        p.stock -= it.cantidad
      }
      n.ventas.unshift(venta)
      if (alumno && metodo === 'fiado') {
        const a = n.alumnos.find((x) => x.id === alumno.id)
        a.deuda += total
        a.fiados.unshift({
          id: uid(),
          ventaId: venta.id,
          fecha: venta.fecha,
          items: detalle.map((d) => ({ nombre: d.nombre, cantidad: d.cantidad, precio: d.precio })),
          monto: total,
          pendiente: total,
          pagado: false,
        })
        a.movimientos.unshift({
          id: uid(),
          fecha: venta.fecha,
          tipo: 'fiado',
          detalle: `Compra fiada · ${detalle.reduce((s, d) => s + d.cantidad, 0)} ítem(s)`,
          monto: total,
        })
        if (a.tutorId) {
          avisar(
            n,
            `tutor:${a.tutorId}`,
            `${a.nombre} ${a.apellido} consumió ${money(total)} en el kiosco (${detalle.reduce((s, d) => s + d.cantidad, 0)} ítem(s) al fiado).`,
            'consumo'
          )
        }
      }
    })
    sync(fs.registrarVenta(venta))
    for (const it of detalle) {
      const p = db.productos.find((x) => x.id === it.productoId)
      if (p) sync(fs.updateStock(it.productoId, Math.max(0, p.stock - it.cantidad)))
    }
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
    if (venta.anulada) throw new Error('La venta ya está anulada.')

    mutate((n) => {
      const v = n.ventas.find((x) => x.id === ventaId)
      v.anulada = true
      for (const it of v.items) {
        const p = n.productos.find((x) => x.id === it.productoId)
        if (p) p.stock += it.cantidad
      }
      if (v.metodo === 'fiado' && v.alumnoId) {
        const a = n.alumnos.find((x) => x.id === v.alumnoId)
        if (a) {
          const f = a.fiados.find((x) => x.ventaId === v.id)
          const revertir = f ? f.pendiente : v.total
          if (f) {
            f.pendiente = 0
            f.pagado = true
          }
          a.deuda = Math.max(0, a.deuda - revertir)
          a.movimientos.unshift({
            id: uid(),
            fecha: new Date().toISOString(),
            tipo: 'anulacion',
            detalle: `Anulación de venta fiada #${v.id.slice(0, 8).toUpperCase()}`,
            monto: -revertir,
          })
        }
      }
    })
    sync(fs.registrarVenta({ ...venta, anulada: true }))
    for (const it of venta.items) {
      const p = db.productos.find((x) => x.id === it.productoId)
      if (p) sync(fs.updateStock(it.productoId, p.stock + it.cantidad))
    }
  }

  /* ================= ALUMNOS / TUTORES ================= */
  // Alta administrativa de un alumno (y opcionalmente su tutor). El tutor se
  // reutiliza si ya existe por nombre o teléfono, para agrupar hermanos.
  const crearAlumno = async ({ nombre, apellido = '', dni, curso, pin, telefono = '', tutorNombre = '', tutorTelefono = '', limiteFiado = 10000 }) => {
    await sleep()
    dni = String(dni ?? '').trim()
    if (!String(nombre ?? '').trim()) throw new Error('Ingresá el nombre completo del alumno.')
    if (!/^\d{6,10}$/.test(dni)) throw new Error('Ingresá un DNI válido (solo números).')
    if (db.alumnos.some((a) => a.dni === dni)) throw new Error(`Ya existe un alumno registrado con DNI ${dni}.`)
    if (!String(curso ?? '').trim()) throw new Error('Ingresá el curso y división.')

    const pinStr = String(pin ?? '').trim()
    const pinFinal = /^\d{4}$/.test(pinStr) ? pinStr : dni.slice(-4) || '1234'
    const tel = telefonoInternacional(tutorTelefono)
    const nomT = String(tutorNombre ?? '').trim()
    const ahora = Date.now()

    // Reutiliza la cuenta del tutor si ya existe por nombre o teléfono
    // (agrupa hermanos sin duplicar al padre/madre).
    const tutor = nomT ? tutorExistente(db.tutores, { nombre: nomT, telefono: tutorTelefono }) : null

    const alumno = {
      id: `a${ahora}`,
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      dni,
      pin: pinFinal,
      telefono: telefonoInternacional(telefono),
      curso: String(curso).trim(),
      tutorId: tutor?.id || (nomT ? `t${ahora}` : null),
      saldo: 0,
      deuda: 0,
      avatar: '🎒',
      limiteDiario: 0,
      limiteFiado: Math.max(0, Number(limiteFiado) || 0),
      fiados: [],
      movimientos: [],
    }
    let tutorFinal = tutor
    if (nomT && !tutor) {
      // Alta automática transparente: el tutor ingresa con su teléfono
      // como usuario y PIN inicial 1234.
      tutorFinal = { id: alumno.tutorId, nombre: nomT, dni: '', usuario: tel, pin: '1234', telefono: tel, hijos: [alumno.id] }
    } else if (tutor && !tutor.hijos.includes(alumno.id)) {
      tutorFinal = { ...tutor, telefono: tel || tutor.telefono, hijos: [...tutor.hijos, alumno.id] }
    }

    mutate((n) => {
      if (tutorFinal) {
        const idx = n.tutores.findIndex((t) => t.id === tutorFinal.id)
        if (idx >= 0) n.tutores[idx] = tutorFinal
        else n.tutores.push(tutorFinal)
      }
      n.alumnos.push(alumno)
    })
    sync(fs.updateAlumno(alumno.id, alumno))
    return { alumno, tutor: tutorFinal }
  }

  // Alta de un tutor junto a sus hijos a cargo: vincula alumnos ya
  // registrados (re-asignándolos si tenían otro tutor) y crea al vuelo los
  // hijos que aún no existen. Devuelve { tutor, alumnos: [los creados] }.
  const crearTutor = async ({ nombre, dni = '', telefono = '', pin = '1234', hijosExistentes = [], hijosNuevos = [] }) => {
    await sleep()
    nombre = String(nombre ?? '').trim()
    dni = String(dni ?? '').replace(/\D/g, '')
    const tel = telefonoInternacional(telefono)
    const pinStr = String(pin ?? '').trim()
    if (!nombre) throw new Error('Ingresá el nombre completo del tutor.')
    if (dni && !/^\d{6,10}$/.test(dni)) throw new Error('Ingresá un DNI válido para el tutor (6 a 10 dígitos).')
    if (dni && db.tutores.some((t) => t.dni === dni)) throw new Error(`Ya existe un tutor con DNI ${dni}.`)
    if (!/^\d{4}$/.test(pinStr)) throw new Error('El PIN del tutor debe tener exactamente 4 dígitos.')

    const ids = [...new Set(hijosExistentes)].filter((id) => db.alumnos.some((a) => a.id === id))
    const dnisNuevos = new Set()
    for (const h of hijosNuevos) {
      const nom = String(h.nombre ?? '').trim()
      const hdni = String(h.dni ?? '').replace(/\D/g, '')
      if (!nom) throw new Error('Completá el nombre de cada hijo nuevo.')
      if (!/^\d{6,10}$/.test(hdni)) throw new Error(`DNI inválido para "${nom}".`)
      if (db.alumnos.some((a) => a.dni === hdni) || dnisNuevos.has(hdni)) {
        throw new Error(`Ya existe un alumno registrado con DNI ${hdni}.`)
      }
      if (!String(h.curso ?? '').trim()) throw new Error(`Ingresá el curso de "${nom}".`)
      dnisNuevos.add(hdni)
    }

    const ahora = Date.now()
    const tutor = { id: `t${ahora}`, nombre, dni, pin: pinStr, telefono: tel, hijos: [] }
    const nuevos = hijosNuevos.map((h, i) => {
      const partes = String(h.nombre).trim().split(/\s+/).filter(Boolean)
      const apellido = partes.length > 1 ? partes.pop() : ''
      const hdni = String(h.dni).replace(/\D/g, '')
      return {
        id: `a${ahora}_${i}`,
        nombre: partes.join(' '),
        apellido,
        dni: hdni,
        pin: hdni.slice(-4) || '1234',
        curso: String(h.curso).trim(),
        tutorId: tutor.id,
        saldo: 0,
        deuda: 0,
        avatar: '🎒',
        limiteDiario: 0,
        limiteFiado: 10000,
        fiados: [],
        movimientos: [],
      }
    })
    tutor.hijos = [...ids, ...nuevos.map((a) => a.id)]

    mutate((n) => {
      for (const id of ids) {
        const a = n.alumnos.find((x) => x.id === id)
        if (!a) continue
        if (a.tutorId && a.tutorId !== tutor.id) {
          const prev = n.tutores.find((t) => t.id === a.tutorId)
          if (prev) prev.hijos = prev.hijos.filter((h) => h !== id)
        }
        a.tutorId = tutor.id
      }
      n.tutores.push(tutor)
      n.alumnos.push(...nuevos)
    })
    for (const a of nuevos) sync(fs.updateAlumno(a.id, a))
    return { tutor, alumnos: nuevos }
  }

  /* ================= LIBRETA / PAGOS ================= */
  const registrarPago = async (alumnoId, monto, origen = 'kiosco') => {
    await sleep()
    monto = Number(monto)
    if (!monto || monto <= 0) throw new Error('Ingresá un monto válido.')
    // El pago en efectivo auto-registrado por alumno/tutor está bloqueado en la
    // UI; acá se refuerza: esos orígenes solo pueden informar transferencias.
    if (origen === 'alumno' || origen === 'tutor') {
      throw new Error('El pago en efectivo solo se recibe en el mostrador. Informá una transferencia.')
    }
    const alumno = db.alumnos.find((a) => a.id === alumnoId)
    if (!alumno) throw new Error('Alumno no encontrado.')

    mutate((n) => {
      const a = n.alumnos.find((x) => x.id === alumnoId)
      const { resto } = abonarFiados(a, monto)
      a.movimientos.unshift({
        id: uid(),
        fecha: new Date().toISOString(),
        tipo: 'abono',
        detalle:
          `Pago de deuda · ${
            origen === 'tutor'
              ? 'Comprobante del tutor'
              : origen === 'alumno'
                ? 'Comprobante del alumno'
                : origen === 'acreditacion'
                  ? 'Transferencia acreditada'
                  : 'Registrado en kiosco'
          }` + (resto > 0 ? ' (excedente a saldo)' : ''),
        monto: -Math.min(monto, monto - resto),
      })
      if (origen === 'kiosco') {
        avisarFamilia(n, a, `Pago de ${money(monto)} registrado en el kiosco para ${a.nombre} ${a.apellido}.`, 'acreditada')
      }
    })
    const prev = clone(db).alumnos.find((x) => x.id === alumnoId)
    if (prev) {
      abonarFiados(prev, monto)
      sync(fs.updateSaldo(alumnoId, { saldo: prev.saldo, deuda: prev.deuda }))
    }
  }

  const recargarSaldo = async (alumnoId, monto, origen = 'kiosco') => {
    await sleep()
    monto = Number(monto)
    if (!monto || monto <= 0) throw new Error('Ingresá un monto válido.')
    mutate((n) => {
      const a = n.alumnos.find((x) => x.id === alumnoId)
      if (!a) return
      // La recarga descuenta primero la deuda (fiados más antiguos primero)
      const { abonado } = abonarFiados(a, monto)
      a.movimientos.unshift({
        id: uid(),
        fecha: new Date().toISOString(),
        tipo: 'recarga',
        detalle:
          `Recarga de saldo · ${origen === 'acreditacion' ? 'Transferencia acreditada' : 'Kiosco'}` +
          (abonado > 0 ? ` ($ ${abonado.toLocaleString('es-AR')} aplicados a deuda)` : ''),
        monto,
      })
      if (origen === 'kiosco') {
        avisarFamilia(n, a, `Recarga de ${money(monto)} acreditada en la billetera de ${a.nombre} ${a.apellido}.`, 'acreditada')
      }
    })
    const prev = clone(db).alumnos.find((x) => x.id === alumnoId)
    if (prev) {
      abonarFiados(prev, monto)
      sync(fs.updateSaldo(alumnoId, { saldo: prev.saldo, deuda: prev.deuda }))
    }
  }

  /* ============ TRANSFERENCIAS PENDIENTES ============ */
  // El alumno/tutor informa una transferencia: queda registrada como
  // pendiente hasta que el mostrador la acredite (sin tocar la deuda todavía).
  const solicitarTransferencia = async ({ alumnoId, monto, origen = 'alumno', tipo = 'deuda' }) => {
    await sleep()
    monto = Number(monto)
    if (!monto || monto <= 0) throw new Error('Ingresá un monto válido.')
    const alumno = db.alumnos.find((a) => a.id === alumnoId)
    if (!alumno) throw new Error('Alumno no encontrado.')
    // Bloqueo anti-spam: una sola solicitud en revisión por alumno.
    if (db.pagosPendientes.some((p) => p.alumnoId === alumnoId)) {
      throw new Error('Ya tenés una transferencia en proceso de revisión. El kiosco debe acreditarla antes de informar otra.')
    }
    const solicitud = {
      id: uid(),
      alumnoId,
      nombre: `${alumno.nombre} ${alumno.apellido}`,
      monto,
      fechaHora: new Date().toISOString(),
      estado: 'pendiente',
      origen,
      tipo, // 'deuda' | 'recarga'
    }
    mutate((n) => {
      n.pagosPendientes.unshift(solicitud)
      avisar(
        n,
        'staff',
        `${solicitud.nombre} informó una transferencia de ${money(monto)} (${tipo === 'recarga' ? 'recarga de saldo' : 'pago de deuda'}) para acreditar.`,
        'pago'
      )
    })
    sync(fs.upsertPagoPendiente(solicitud))
    return solicitud
  }

  // Acredita una solicitud: descuenta la deuda (o suma al saldo) y asienta
  // el movimiento en la cuenta del alumno reutilizando registrarPago.
  const acreditarPago = async (pagoId) => {
    const pago = db.pagosPendientes.find((p) => p.id === pagoId)
    if (!pago) throw new Error('La solicitud ya fue procesada.')
    const alumnoPago = db.alumnos.find((a) => a.id === pago.alumnoId)
    if (!alumnoPago) throw new Error('El alumno ya no existe.')
    mutate((n) => {
      n.pagosPendientes = n.pagosPendientes.filter((p) => p.id !== pagoId)
      avisarFamilia(n, alumnoPago, `Transferencia de ${money(pago.monto)} acreditada a ${pago.nombre}.`, 'acreditada')
    })
    sync(fs.upsertPagoPendiente({ ...pago, estado: 'acreditado' }))
    if (pago.tipo === 'recarga') await recargarSaldo(pago.alumnoId, pago.monto, 'acreditacion')
    else await registrarPago(pago.alumnoId, pago.monto, 'acreditacion')
    return pago
  }

  const descartarPago = async (pagoId) => {
    await sleep(90)
    const pago = db.pagosPendientes.find((p) => p.id === pagoId)
    const alumnoPago = pago && db.alumnos.find((a) => a.id === pago.alumnoId)
    mutate((n) => {
      n.pagosPendientes = n.pagosPendientes.filter((p) => p.id !== pagoId)
      if (pago && alumnoPago) {
        avisarFamilia(n, alumnoPago, `La transferencia de ${money(pago.monto)} informada por ${pago.nombre} fue rechazada.`, 'rechazada')
      }
    })
    if (pago) sync(fs.upsertPagoPendiente({ ...pago, estado: 'descartado' }))
  }

  const setLimiteDiario = async (alumnoId, limite) => {
    await sleep(90)
    mutate((n) => {
      const a = n.alumnos.find((x) => x.id === alumnoId)
      if (a) a.limiteDiario = Math.max(0, Number(limite) || 0)
    })
  }

  // Perfil del alumno: avatar (clave emoji) y/o foto (DataURL comprimida).
  const updateAlumno = async (alumnoId, patch) => {
    await sleep(90)
    mutate((n) => {
      const a = n.alumnos.find((x) => x.id === alumnoId)
      if (a) Object.assign(a, patch)
    })
    sync(fs.updateAlumno(alumnoId, patch))
  }

  // Ajustes del tutor (PIN de acceso, teléfono...) desde "Gestionar Acceso".
  const updateTutor = async (tutorId, patch) => {
    await sleep(90)
    if (patch?.pin !== undefined && !/^\d{4}$/.test(String(patch.pin).trim())) {
      throw new Error('El PIN del tutor debe tener exactamente 4 dígitos.')
    }
    mutate((n) => {
      const t = n.tutores.find((x) => x.id === tutorId)
      if (t) Object.assign(t, patch)
    })
  }

  /* ================= STAFF / VENDEDORES ================= */
  const addVendedor = async ({ nombre, usuario, clave }) => {
    await sleep()
    const user = String(usuario).trim().toLowerCase()
    if (!nombre?.trim()) throw new Error('Ingresá el nombre del vendedor.')
    if (!user) throw new Error('Ingresá un nombre de usuario.')
    if (!String(clave).trim()) throw new Error('Ingresá una contraseña.')
    if (db.staff.some((s) => s.usuario === user)) throw new Error('Ese usuario ya existe.')
    const u = { id: uid(), usuario: user, clave: String(clave), nombre: nombre.trim(), rol: 'vendedor' }
    mutate((n) => n.staff.push(u))
    return u
  }

  const deleteVendedor = async (id) => {
    await sleep()
    mutate((n) => {
      n.staff = n.staff.filter((s) => !(s.id === id && s.rol === 'vendedor'))
    })
  }

  // El staff actualiza su propia clave de acceso ("Mi clave" en Config).
  const updateStaffClave = async (staffId, clave) => {
    await sleep(90)
    const c = String(clave ?? '').trim()
    if (c.length < 4) throw new Error('La clave debe tener al menos 4 caracteres.')
    mutate((n) => {
      const s = n.staff.find((x) => x.id === staffId)
      if (s) s.clave = c
    })
  }

  /* ================= CONFIG ================= */
  const updateConfig = async (patch) => {
    await sleep()
    const abre = patch?.abierto === true && !db.config.abierto
    mutate((n) => {
      Object.assign(n.config, patch)
      // Apertura de caja: el mostrador se entera por la campanita.
      if (abre) avisar(n, 'staff', 'Apertura de caja: el kiosco habilitó el mostrador.', 'apertura')
    })
  }

  const resetDemo = async () => {
    await sleep(200)
    setDb(buildSeed())
    setSession(null)
    notify('Datos de demostración restablecidos.', 'info')
  }

  const alumnoSesion =
    session?.rol === 'alumno' ? db.alumnos.find((a) => a.id === session.id) || null : null
  const tutorSesion =
    session?.rol === 'tutor' ? db.tutores.find((t) => t.id === session.id) || null : null

  // Categorías base + las que ya existan en productos (creadas al vuelo)
  const categorias = [
    ...new Set([...CATEGORIAS, ...db.productos.map((p) => p.categoria).filter(Boolean)]),
  ]

  const value = {
    db,
    config: db.config,
    productos: db.productos,
    alumnos: db.alumnos,
    tutores: db.tutores,
    staff: db.staff,
    ventas: db.ventas,
    pagosPendientes: db.pagosPendientes,
    notificaciones: db.notificaciones || [],
    session,
    alumnoSesion,
    tutorSesion,
    categorias,
    notify,
    loginAlumno,
    loginTutor,
    loginStaff,
    logout,
    addProducto,
    updateProducto,
    deleteProducto,
    registrarVenta,
    aprobarCobroEspera,
    anularVenta,
    crearAlumno,
    crearTutor,
    registrarPago,
    recargarSaldo,
    solicitarTransferencia,
    acreditarPago,
    descartarPago,
    setLimiteDiario,
    updateAlumno,
    updateTutor,
    persistencia: { modo: remoto ? 'firebase' : 'local', remoto, useFirebase: USE_FIREBASE },
    addVendedor,
    deleteVendedor,
    updateStaffClave,
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
