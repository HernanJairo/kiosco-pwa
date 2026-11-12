import { createContext, useContext, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { buildSeed, CATEGORIAS } from './seedData'
import { firebaseLista } from '../firebase/firebaseConfig'
import * as fs from '../firebase/firestoreService'
import * as ops from './operaciones'
import { clientePorIdentificador } from '../utils/acceso'
import { money } from '../utils/format'

const DB_KEY = 'kiosco_db_v2'
const SES_KEY = 'kiosco_session_v2'

// ==== Persistencia remota (opcional, plug & play) ====
// true → intenta sincronizar con Firestore cuando las credenciales de
// firebaseConfig.js estén cargadas y el SDK instalado (npm i firebase).
// false (por defecto, demo) → persiste solo en localStorage con seedData.
const USE_FIREBASE = false

const sleep = (ms = 160) => new Promise((r) => setTimeout(r, ms))
const clone = (o) => JSON.parse(JSON.stringify(o))
const uid = ops.uid

const KioscoContext = createContext(null)
// eslint-disable-next-line react/only-export-components
export const useKiosco = () => useContext(KioscoContext)

const ROLES_VALIDOS = ['cliente', 'vendedor', 'admin']

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
      return parsed
    }
  } catch {
    /* datos corruptos: se regenera el seed */
  }
  return buildSeed()
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
          if (clientes?.length) n.clientes = clientes
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
  // TopBar). `para` es 'staff' o 'cliente:<id>'; el feed se filtra según
  // la sesión activa.
  const avisar = (n, para, texto, tipo = 'info') => {
    if (!Array.isArray(n.notificaciones)) n.notificaciones = []
    n.notificaciones.unshift({ id: uid(), fecha: new Date().toISOString(), para, texto, tipo })
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

    mutate((n) => {
      ops.aplicarVentaDb(n, { venta, detalle, metodo, clienteId: cliente?.id, descontarStock: !reservado })
      if (cliente && metodo === 'fiado') {
        const c = n.clientes.find((x) => x.id === cliente.id)
        avisarCliente(
          n,
          c,
          `Compra en cuenta corriente por ${money(total)} (${detalle.reduce((s, d) => s + d.cantidad, 0)} ítem(s)).`,
          'consumo'
        )
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
    mutate((n) => ops.anularVentaDb(n, ventaId))
    sync(fs.registrarVenta({ ...venta, anulada: true }))
    for (const it of venta.items) {
      const p = db.productos.find((x) => x.id === it.productoId)
      if (p) sync(fs.updateStock(it.productoId, p.stock + it.cantidad))
    }
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
    })
    sync(fs.updateCliente(cliente.id, cliente))
    return { cliente }
  }

  // Regla de integridad: no se puede eliminar un cliente con deuda > 0.
  const eliminarCliente = async (clienteId) => {
    await sleep()
    const eliminado = ops.eliminarClienteDb(clone(db), clienteId) // valida antes de mutar
    mutate((n) => ops.eliminarClienteDb(n, clienteId))
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
    })
    sync(fs.updateCliente(clienteId, { pin }))
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
    mutate((n) => {
      const { cliente: c } = ops.aplicarPagoDb(n, clienteId, monto, detalle)
      if (origen === 'kiosco') {
        avisarCliente(n, c, `Pago de ${money(monto)} registrado en el kiosco.`, 'acreditada')
      }
    })
    const prev = clone(db).clientes.find((x) => x.id === clienteId)
    if (prev) {
      ops.abonarFiados(prev, monto)
      sync(fs.updateSaldo(clienteId, { saldo: prev.saldo, deuda: prev.deuda }))
    }
  }

  const recargarSaldo = async (clienteId, monto, origen = 'kiosco') => {
    await sleep()
    monto = Number(monto)
    if (!monto || monto <= 0) throw new Error('Ingresá un monto válido.')
    const cliente = db.clientes.find((c) => c.id === clienteId)
    if (!cliente) throw new Error('Cliente no encontrado.')
    const detalle = origen === 'acreditacion' ? 'Transferencia acreditada' : 'Kiosco'
    mutate((n) => {
      const { cliente: c } = ops.aplicarRecargaDb(n, clienteId, monto, detalle)
      if (origen === 'kiosco') {
        avisarCliente(n, c, `Recarga de ${money(monto)} acreditada en tu billetera.`, 'acreditada')
      }
    })
    const prev = clone(db).clientes.find((x) => x.id === clienteId)
    if (prev) {
      ops.abonarFiados(prev, monto)
      sync(fs.updateSaldo(clienteId, { saldo: prev.saldo, deuda: prev.deuda }))
    }
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
      if (resultado.solicitud.tipo === 'RESET_PIN') {
        sync(fs.updateCliente(resultado.cliente.id, { pin: resultado.cliente.pin }))
      } else {
        sync(fs.updateSaldo(resultado.cliente.id, { saldo: resultado.cliente.saldo, deuda: resultado.cliente.deuda }))
      }
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
    return actualizado
  }

  const eliminarPersonal = async (id) => {
    await sleep()
    ops.eliminarPersonalDb(clone(db), id) // valida antes de mutar (último admin)
    mutate((n) => ops.eliminarPersonalDb(n, id))
  }

  // Cambio de PIN propio desde "Mi Perfil": exige el PIN vigente.
  const cambiarPinPersonal = async (id, pinActual, pinNuevo) => {
    await sleep(90)
    mutate((n) => ops.cambiarPinPersonalDb(n, id, pinActual, pinNuevo))
  }

  /* ================= ENCARGOS (retiro en local) =================
     El cliente logueado envía su carrito "para armar" sin pagar aún.
     El staff lo prepara, lo marca listo y el cliente lo retira en caja
     mostrando su QR; el cobro se registra como venta normal. */
  const enviarEncargo = async (items, retiroTercero = null) => {
    await sleep(120)
    if (!clienteSesion) throw new Error('Tenés que iniciar sesión para encargar.')
    if (!config.recibiendoEncargos) throw new Error('El kiosco no está recibiendo encargos ahora.')
    let creado = null
    mutate((n) => {
      creado = ops.nuevoEncargo(n, { clienteId: clienteSesion.id, items, retiroTercero })
      avisar(
        n,
        'staff',
        `Nuevo encargo de ${creado.clienteNombre} · ${creado.items.reduce((s, i) => s + i.cantidad, 0)} ítem(s) · ${money(creado.total)}.`,
        'encargo'
      )
    })
    return creado
  }

  // Ajuste por faltante de góndola ("caso 999"): vendedor y admin pueden
  // quitar ítems del pedido; el stock reservado vuelve a la góndola.
  const ajustarItemEncargo = async (encargoId, productoId, cantidadQuitar) => {
    await sleep(60)
    let e = null
    mutate((n) => {
      e = ops.ajustarItemEncargoDb(n, encargoId, productoId, cantidadQuitar, { ajustadoPor: session?.nombre })
    })
    return e
  }

  const guardarTerceroEncargo = async (encargoId, datos) => {
    await sleep(60)
    let e = null
    mutate((n) => {
      e = ops.guardarTerceroEncargoDb(n, encargoId, datos)
    })
    return e
  }

  const marcarEncargoListo = async (encargoId) => {
    await sleep(90)
    let e = null
    mutate((n) => {
      e = ops.marcarEncargoListoDb(n, encargoId, { preparadoPor: session?.nombre || 'mostrador' })
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
    return e
  }

  // El mostrador lo cierra al cobrar el pedido (venta normal asociada).
  const entregarEncargo = async (encargoId, retiradoPor = null) => {
    await sleep(60)
    let e = null
    mutate((n) => {
      e = ops.entregarEncargoDb(n, encargoId, { retiradoPor })
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
    return e
  }

  const cancelarEncargo = async (encargoId) => {
    await sleep(60)
    let e = null
    mutate((n) => {
      e = ops.cancelarEncargoDb(n, encargoId)
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
        avisar(n, 'admin', `${texto}: ${session?.nombre || 'mostrador'} (${session?.rol || '?'}) lo cambió.`, 'auditoria')
        avisar(n, 'staff', `${texto} — por ${session?.nombre || 'mostrador'}.`, 'auditoria')
      }
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
