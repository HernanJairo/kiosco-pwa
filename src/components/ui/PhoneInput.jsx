import { useState } from 'react'
import { numeroLocal, telefonoInternacional } from '../../utils/whatsapp'

// Input de teléfono simple: el usuario escribe el número nacional como lo
// conoce ('388...', '15...', con 0, guiones o espacios) y onChange recibe
// siempre el internacional limpio para wa.me (ej. '5493885123456').
// Debajo se muestra cómo queda normalizado.
export default function PhoneInput({
  label = 'Teléfono / WhatsApp',
  value = '',
  onChange,
  required = false,
  placeholder,
}) {
  // Los modales se remontan en cada apertura: el estado inicial basta.
  const [local, setLocal] = useState(() => numeroLocal(value))
  const e164 = telefonoInternacional(local)

  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>}
      <input
        value={local}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d\s-]/g, '')
          setLocal(v)
          onChange?.(telefonoInternacional(v))
        }}
        inputMode="tel"
        placeholder={placeholder ?? 'Ej: 3886003447'}
        required={required}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 outline-none placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
      />
      <p className="mt-1 text-[11px] text-slate-400">
        {e164
          ? `Se guarda como +${e164} (listo para WhatsApp).`
          : '(cód. de área + número)'}
      </p>
    </label>
  )
}
