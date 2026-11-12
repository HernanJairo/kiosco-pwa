// ==== Identificación de cuentas (alumno / tutor) ====
// Helpers puros compartidos por KioscoContext (login, alta automática de
// tutor), el modal de recuperación de PIN y el script de QA. Un tutor
// puede identificarse por DNI, por su `usuario` (teléfono normalizado que
// se genera en el alta automática) o directamente por su teléfono.

import { telefonoInternacional } from './whatsapp.js'

const norm = (s) => String(s ?? '').trim().toLowerCase()

// Busca un tutor ya registrado por nombre normalizado o por teléfono
// internacional, para reutilizar la cuenta (hermanos) en lugar de
// duplicar al padre/madre.
export function tutorExistente(tutores, { nombre = '', telefono = '' } = {}) {
  const nom = norm(nombre)
  const tel = telefonoInternacional(telefono)
  return (
    (tutores || []).find(
      (t) =>
        (nom && norm(t.nombre) === nom) ||
        (tel && telefonoInternacional(t.telefono) === tel)
    ) || null
  )
}

// Resuelve un tutor a partir del identificador de ingreso: DNI, usuario
// (teléfono normalizado) o teléfono escrito en cualquier formato local.
export function tutorPorIdentificador(tutores, ident) {
  const id = String(ident ?? '').trim()
  if (!id) return null
  const tel = telefonoInternacional(id)
  return (
    (tutores || []).find(
      (t) =>
        (t.dni && t.dni === id) ||
        (t.usuario && (t.usuario === id || t.usuario === tel)) ||
        (tel && telefonoInternacional(t.telefono) === tel)
    ) || null
  )
}

// Resuelve un alumno por DNI o por su teléfono propio (campo opcional).
export function alumnoPorIdentificador(alumnos, ident) {
  const id = String(ident ?? '').trim()
  if (!id) return null
  const tel = telefonoInternacional(id)
  return (
    (alumnos || []).find(
      (a) => a.dni === id || (tel && telefonoInternacional(a.telefono) === tel)
    ) || null
  )
}
