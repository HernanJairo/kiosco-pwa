// ==== Identificación de cuentas de clientes ====
// Helper puro compartido por el login y el modal de recuperación de PIN.
// El cliente se identifica por DNI (identificador principal) o por su
// teléfono propio en cualquier formato local.

import { telefonoInternacional } from './whatsapp.js'

// Resuelve un cliente por DNI o por su teléfono propio (campo opcional).
export function clientePorIdentificador(clientes, ident) {
  const id = String(ident ?? '').trim()
  if (!id) return null
  const tel = telefonoInternacional(id)
  return (
    (clientes || []).find(
      (c) => c.dni === id || (tel && c.telefono && telefonoInternacional(c.telefono) === tel)
    ) || null
  )
}
