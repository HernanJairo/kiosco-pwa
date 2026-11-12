// ==== Identificación de cuentas de clientes ====
// Helper puro compartido por el login y el modal de recuperación de PIN.
// El cliente se identifica por DNI (identificador principal), por su
// correo electrónico (opcional) o por su teléfono propio en cualquier
// formato local.

import { telefonoInternacional } from './whatsapp.js'

// Resuelve un cliente por DNI, correo o teléfono (campos opcionales).
export function clientePorIdentificador(clientes, ident) {
  const id = String(ident ?? '').trim()
  if (!id) return null
  const correo = id.toLowerCase()
  const tel = telefonoInternacional(id)
  return (
    (clientes || []).find(
      (c) =>
        c.dni === id ||
        (id.includes('@') && c.email && c.email === correo) ||
        (tel && c.telefono && telefonoInternacional(c.telefono) === tel)
    ) || null
  )
}
