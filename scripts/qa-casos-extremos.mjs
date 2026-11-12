// QA de casos extremos — simula los flujos críticos sobre los mismos
// helpers puros que usa la app (utils/acceso, utils/whatsapp) y el seed.
// Uso: node scripts/qa-casos-extremos.mjs
import { buildSeed } from '../src/context/seedData.js'
import {
  APP_URL,
  telefonoInternacional,
  textoAcceso,
  textoResetPin,
  waLink,
} from '../src/utils/whatsapp.js'
import {
  alumnoPorIdentificador,
  tutorExistente,
  tutorPorIdentificador,
} from '../src/utils/acceso.js'

let ok = 0
let fallos = 0
const check = (nombre, cond, extra = '') => {
  if (cond) {
    ok++
    console.log(`  ✔ ${nombre}`)
  } else {
    fallos++
    console.error(`  ✘ ${nombre} ${extra}`)
  }
}

const db = buildSeed()

/* ---------- 1. Ingreso con PIN incorrecto ---------- */
console.log('\n[1] Login con PIN incorrecto')
{
  const loginAlumno = (dni, pin) => {
    const a = db.alumnos.find((x) => x.dni === String(dni).trim() && x.pin === String(pin).trim())
    if (!a) throw new Error('DNI o PIN incorrectos.')
    return a
  }
  const loginTutor = (ident, pin) => {
    const t = tutorPorIdentificador(db.tutores, ident)
    if (!t || t.pin !== String(pin).trim()) throw new Error('Usuario o PIN incorrectos.')
    return t
  }
  let error = null
  try { loginAlumno('45111222', '9999') } catch (e) { error = e }
  check('alumno con PIN erróneo es rechazado', error?.message === 'DNI o PIN incorrectos.')
  check('alumno con PIN correcto ingresa', loginAlumno('45111222', '1234').id === 'a1')
  error = null
  try { loginTutor('30123456', '0000') } catch (e) { error = e }
  check('tutor con PIN erróneo es rechazado', error?.message === 'Usuario o PIN incorrectos.')
}

/* ---------- 2. Recuperación con DNI no registrado ---------- */
console.log('\n[2] Recuperación de acceso')
{
  check('DNI inexistente → sin coincidencia', alumnoPorIdentificador(db.alumnos, '99999999') === null)
  check('DNI registrado → encuentra al alumno', alumnoPorIdentificador(db.alumnos, '45111222')?.id === 'a1')
  check(
    'tutor por teléfono local "11 5555-1001" → t1',
    tutorPorIdentificador(db.tutores, '11 5555-1001')?.id === 't1'
  )
  const msg = textoResetPin({ nombre: 'María González', identificador: '45111222' })
  check(
    'mensaje de reseteo prearmado',
    msg === 'Hola! Soy María González, solicito restablecer mi PIN de acceso para KioscoApp (DNI/Tel: 45111222).',
    `→ ${msg}`
  )
  check('waLink apunta al chat oficial', waLink('+5493881234567', msg).startsWith('https://wa.me/5493881234567?text='))
}

/* ---------- 3. Alta con tutor preexistente (sin duplicar) ---------- */
console.log('\n[3] Tutor preexistente / auto-alta')
{
  const antes = db.tutores.length
  const t = tutorExistente(db.tutores, { nombre: 'Carlos González', telefono: '' })
  check('mismo nombre → reutiliza t1 (no duplica)', t?.id === 't1' && db.tutores.length === antes)
  const t2 = tutorExistente(db.tutores, { nombre: 'Otro Nombre', telefono: '1155551002' })
  check('mismo teléfono → reutiliza t2 (no duplica)', t2?.id === 't2')
  check('tutor desconocido → null (se crea)', tutorExistente(db.tutores, { nombre: 'Nadie Nuevo', telefono: '1100000000' }) === null)

  // Auto-alta simulada: igual que crearAlumno → usuario = tel normalizado, pin '1234'.
  const telNuevo = telefonoInternacional('0388 15 512-3456')
  const autoTutor = { id: 'tX', nombre: 'Nuevo Tutor', dni: '', usuario: telNuevo, pin: '1234', telefono: telNuevo, hijos: [] }
  check('auto-tutor: usuario es el teléfono normalizado', autoTutor.usuario === telNuevo && telNuevo === '5493885123456')
  check(
    'auto-tutor ingresa con su teléfono local + PIN 1234',
    tutorPorIdentificador([...db.tutores, autoTutor], '388155123456')?.id === 'tX'
  )
}

/* ---------- 4. Texto de bienvenida con credenciales del tutor ---------- */
console.log('\n[4] Mensaje de bienvenida (textoAcceso)')
{
  const alumno = { nombre: 'Ana', apellido: 'Pérez', dni: '50123456', pin: '3456' }
  const tutor = { nombre: 'Carla Pérez', dni: '', usuario: '5493887778888', pin: '1234', telefono: '5493887778888' }
  const txt = textoAcceso({ alumno, tutor, config: db.config })
  check('saluda al tutor y registra al alumno', txt.includes('Hola Carla Pérez! Registramos a Ana Pérez'))
  check('incluye ingreso como TUTOR con Usuario teléfono', txt.includes('ingresando como TUTOR con tu Usuario: 5493887778888'))
  check('incluye "PIN inicial: 1234"', txt.includes('PIN inicial: 1234'))
  check('incluye la URL de la app', txt.includes(APP_URL))
}

/* ---------- 5. Bloqueo anti-spam de comprobantes ---------- */
console.log('\n[5] Bloqueo de transferencias duplicadas')
{
  // Réplica exacta de la guarda en solicitarTransferencia (KioscoContext).
  const puedeInformar = (alumnoId) =>
    !db.pagosPendientes.some((p) => p.alumnoId === alumnoId)
  check('sin pendientes → puede informar', puedeInformar('a1') === true)
  db.pagosPendientes.push({ id: 'pp1', alumnoId: 'a1', nombre: 'María González', monto: 1000, estado: 'pendiente' })
  check('con pendiente → bloqueado', puedeInformar('a1') === false)
  check('otro alumno → sigue habilitado', puedeInformar('a2') === true)
}

/* ---------- 6. Normalización de teléfonos ---------- */
console.log('\n[6] Normalización telefónica')
{
  check('"0388 15-5123456" → 5493885123456', telefonoInternacional('0388 15-5123456') === '5493885123456')
  check('"+54 9 388 512-3456" → 5493885123456', telefonoInternacional('+54 9 388 512-3456') === '5493885123456')
  check('vacío → ""', telefonoInternacional('') === '')
}

/* ---------- Resumen ---------- */
console.log(`\n${ok} verificaciones OK · ${fallos} fallo(s)`)
process.exit(fallos ? 1 : 0)
