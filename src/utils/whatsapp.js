// ==== Teléfonos internacionales para WhatsApp ====
// wa.me exige el número en formato internacional, solo dígitos, sin '+'.
// Estos helpers normalizan lo que escribe el usuario (con 0 troncal, "15"
// celular, guiones, espacios o prefijo completo) a ese formato, para que
// WhatsApp nunca rechace el enlace por código de país.

export const PAIS_DEFECTO = 'AR'

export const PAISES_TEL = [
  { iso: 'AR', nombre: 'Argentina', bandera: '🇦🇷', dial: '54', movil: '9' },
  { iso: 'BO', nombre: 'Bolivia', bandera: '🇧🇴', dial: '591' },
  { iso: 'PY', nombre: 'Paraguay', bandera: '🇵🇾', dial: '595' },
  { iso: 'CL', nombre: 'Chile', bandera: '🇨🇱', dial: '56' },
  { iso: 'UY', nombre: 'Uruguay', bandera: '🇺🇾', dial: '598' },
  { iso: 'BR', nombre: 'Brasil', bandera: '🇧🇷', dial: '55' },
]

export const paisPorIso = (iso) => PAISES_TEL.find((p) => p.iso === iso) || PAISES_TEL[0]

// Parte nacional limpia: sin 0 troncal ni '15' celular (regla argentina).
const limpiarNacional = (s, iso) => {
  s = s.replace(/^0+/, '')
  if (iso === 'AR') {
    // '155123456' (celular sin área) o '388155123456' (área + 15 + número)
    if (/^15\d{6,8}$/.test(s)) s = s.slice(2)
    else s = s.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2')
  }
  return s
}

// "0388 15-5123456" -> "5493885123456" | "+549388..." -> "549388..."
// Devuelve solo dígitos listos para wa.me; '' si no hay número usable.
export function telefonoInternacional(numero, iso = PAIS_DEFECTO) {
  const pais = paisPorIso(iso)
  let s = String(numero ?? '')
    .replace(/\D/g, '')
    .replace(/^00/, '')
  if (!s) return ''
  if (s.startsWith(pais.dial)) s = s.slice(pais.dial.length)
  if (iso === 'AR' && s.startsWith(pais.movil)) s = s.slice(1)
  s = limpiarNacional(s, iso)
  return s ? pais.dial + (pais.movil || '') + s : ''
}

// Inverso de telefonoInternacional: dado un número guardado (internacional
// o como lo tipeó el usuario), devuelve la parte nacional para mostrarla
// en el input junto al selector de país.
export function numeroLocal(numero, iso = PAIS_DEFECTO) {
  const pais = paisPorIso(iso)
  let s = String(numero ?? '')
    .replace(/\D/g, '')
    .replace(/^00/, '')
  if (s.startsWith(pais.dial)) s = s.slice(pais.dial.length)
  if (iso === 'AR' && s.startsWith(pais.movil) && s.length > 1) s = s.slice(1)
  return s
}

export const waLink = (telefono, texto, iso = PAIS_DEFECTO) =>
  `https://wa.me/${telefonoInternacional(telefono, iso) || String(telefono ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`

export const textoComprobante = ({ monto, nombre, dni }) =>
  `Hola! Informo transferencia de $${Number(monto || 0).toLocaleString('es-AR')} para ${nombre} (DNI ${dni}). Adjunto el comprobante por acá.`

export const APP_URL = 'https://kiosco-pwa.vercel.app'

export const textoAcceso = ({ alumno, tutor, config }) => {
  const usuarioTutor = tutor
    ? tutor.usuario || telefonoInternacional(tutor.telefono) || tutor.dni || '-'
    : null
  return (
    `Hola${tutor ? ` ${tutor.nombre}` : ''}! Registramos a ${alumno.nombre} ${alumno.apellido} en ${config?.nombreKiosco || 'el kiosco'}.\n` +
    `Acceso ALUMNO → Usuario (DNI): ${alumno.dni} · PIN: ${alumno.pin}\n` +
    (tutor
      ? `Podés consultar sus gastos, saldos y autorizar transferencias ingresando como TUTOR con tu Usuario: ${usuarioTutor} y PIN inicial: ${tutor.pin || '1234'} en ${APP_URL}`
      : `Ingresá acá: ${APP_URL}`)
  )
}

export const textoTutor = ({ tutor, hijos = [], config }) =>
  `Hola ${tutor.nombre}! Ya está habilitada tu cuenta de tutor/a en ${config?.nombreKiosco || 'el kiosco escolar'}.\n` +
  `Hijos a cargo: ${hijos.length ? hijos.map((h) => `${h.nombre} ${h.apellido} (${h.curso})`).join(', ') : 'a confirmar en mostrador'}\n` +
  `Usuario: ${tutor.dni || tutor.usuario || telefonoInternacional(tutor.telefono) || '-'}\nPIN: ${tutor.pin}\n` +
  `Ingresá acá: ${APP_URL}`

// Mensaje prearmado del flujo "¿Olvidaste tu PIN?": el usuario lo envía al
// chat oficial del kiosco para pedir el restablecimiento asistido.
export const textoResetPin = ({ nombre, identificador }) =>
  `Hola! Soy ${nombre}, solicito restablecer mi PIN de acceso para KioscoApp (DNI/Tel: ${identificador}).`
