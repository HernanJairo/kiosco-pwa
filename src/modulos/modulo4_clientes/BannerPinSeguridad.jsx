import { useState } from 'react'
import { X } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'

// PIN "de fábrica": el que asigna el alta por defecto ('1234', '1111' o
// los últimos 4 dígitos del DNI). Con cualquiera de esos se sugiere
// personalizarlo en el primer ingreso.
const esPinDefault = (pin, dni) =>
  ['1234', '1111'].includes(String(pin)) || (!!dni && String(pin) === String(dni).slice(-4))

// Banner sutil y descartable de primer ingreso: invita a cambiar el PIN
// por uno propio de 4 dígitos. `onGuardar` recibe el PIN nuevo y debe
// persistirlo (updateCliente).
export default function BannerPinSeguridad({ pin, dni, onGuardar }) {
  const { notify } = useKiosco()
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)
  const [nuevo, setNuevo] = useState('')
  const [busy, setBusy] = useState(false)

  if (!esPinDefault(pin, dni) || dismissed) return null

  const guardar = async (e) => {
    e.preventDefault()
    if (!/^\d{4}$/.test(nuevo)) return notify('El PIN debe tener exactamente 4 dígitos.', 'error')
    setBusy(true)
    try {
      await onGuardar(nuevo)
      notify('PIN actualizado. Usalo en tu próximo ingreso.')
      setDismissed(true)
      setOpen(false)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-medium text-indigo-800">
        <span aria-hidden="true">🔐</span>
        <span className="min-w-0 flex-1">Por seguridad, te sugerimos personalizar tu PIN de acceso.</span>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-2 transition-colors hover:text-indigo-900"
        >
          Cambiar PIN
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Descartar aviso"
          className="shrink-0 rounded p-0.5 text-indigo-400 transition-colors hover:bg-indigo-100 hover:text-indigo-600"
        >
          <X size={13} />
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Cambiar PIN de acceso">
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            Elegí un PIN de <b>4 dígitos</b> que solo vos conozcas. Lo vas a usar
            para ingresar desde ahora.
          </p>
          <Input
            label="Nuevo PIN (4 dígitos)"
            inputMode="numeric"
            maxLength={4}
            autoFocus
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value.replace(/\D/g, '').slice(0, 4))}
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar PIN'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
