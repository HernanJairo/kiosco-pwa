import { useRef, useState } from 'react'
import { Banknote, Check, Copy, HandCoins, Hourglass, Landmark, MessageCircle } from 'lucide-react'
import { useKiosco } from '../../context/KioscoContext'
import { textoComprobante, waLink } from '../../utils/whatsapp'
import { money } from '../../utils/format'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select } from '../../components/ui/Input'

export default function PagoTransferenciaModal({ alumno, origen = 'kiosco', open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Pago / recarga">
      {open && alumno && <FormPago alumno={alumno} origen={origen} onClose={onClose} />}
    </Modal>
  )
}

// Se remonta en cada apertura: el estado inicial siempre refleja la deuda vigente.
function FormPago({ alumno, origen, onClose }) {
  const { config, registrarPago, solicitarTransferencia, notify, session, pagosPendientes } = useKiosco()
  const [tipo, setTipo] = useState(alumno.deuda > 0 ? 'deuda' : 'recarga')
  const [monto, setMonto] = useState(alumno.deuda > 0 ? String(alumno.deuda) : '')
  const [metodoPago, setMetodoPago] = useState('transferencia')
  const [waUrl, setWaUrl] = useState(null) // link de comprobante listo tras registrar
  const [copiado, setCopiado] = useState(null) // 'alias' | 'cbu'
  const [busy, setBusy] = useState(false)
  // Guarda síncrona: el primer clic bloquea el envío antes de que React
  // repinte el botón, evitando duplicados por toques accidentales.
  const enviando = useRef(false)

  // Bloqueo anti-spam: si el alumno ya tiene una solicitud pendiente no se
  // puede informar otra hasta que el mostrador la procese.
  const enRevision = pagosPendientes.some((p) => p.alumnoId === alumno.id)

  // [C-2] El efectivo solo lo cobra el mostrador (vendedor/admin): alumnos y
  // tutores solo pueden informar una transferencia pendiente de acreditación.
  const puedeEfectivo =
    session?.rol !== 'alumno' && session?.rol !== 'tutor' && origen !== 'alumno' && origen !== 'tutor'

  const nombre = `${alumno.nombre} ${alumno.apellido}`
  const montoNum = Number(monto) || 0

  const copiar = async (texto, campo) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(campo)
      setTimeout(() => setCopiado((c) => (c === campo ? null : c)), 1800)
    } catch {
      notify('No se pudo copiar al portapapeles.', 'warn')
    }
  }

  const elegirTipo = (t) => {
    setTipo(t)
    setMonto(t === 'deuda' ? String(alumno.deuda || '') : '')
  }

  // a) Registra la solicitud como pendiente en KioscoContext.
  // b) [M-6] En lugar de window.open tras un await (los navegadores lo
  //    bloquean como pop-up), deja listo un enlace visible "Abrir WhatsApp".
  // c) El badge de "pendiente de acreditación" lo dibuja la vista al cerrar.
  const confirmarTransferencia = async (e) => {
    e.preventDefault()
    if (enviando.current) return
    enviando.current = true
    setBusy(true)
    try {
      await solicitarTransferencia({ alumnoId: alumno.id, monto: montoNum, origen, tipo })
      const texto = textoComprobante({ monto: montoNum, nombre, dni: alumno.dni })
      setWaUrl(waLink(config.whatsapp, texto))
      notify(`Transferencia de ${money(montoNum)} informada: pendiente de acreditación.`, 'info')
    } catch (err) {
      notify(err.message, 'error')
      enviando.current = false
    } finally {
      setBusy(false)
    }
  }

  const confirmarEfectivo = async (e) => {
    e.preventDefault()
    if (enviando.current) return
    enviando.current = true
    setBusy(true)
    try {
      await registrarPago(alumno.id, montoNum, origen)
      notify(`Pago de ${money(montoNum)} registrado para ${alumno.nombre}.`)
      onClose()
    } catch (err) {
      notify(err.message, 'error')
      enviando.current = false
    } finally {
      setBusy(false)
    }
  }

  if (waUrl) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <b>Aviso registrado.</b> La transferencia de {money(montoNum)} quedó pendiente de
          acreditación: se impacta cuando el mostrador la verifique.
        </div>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <MessageCircle size={17} /> Abrir WhatsApp
        </a>
        <p className="text-[11px] text-slate-400">
          Se abre el chat con el kiosco ({config.whatsapp}) para adjuntar el comprobante.
        </p>
        <Button variant="secondary" onClick={onClose} className="w-full">
          Listo
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={metodoPago === 'efectivo' && puedeEfectivo ? confirmarEfectivo : confirmarTransferencia}
      className="flex flex-col gap-3"
    >
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
        <b>{nombre}</b> · {alumno.curso}
        <br />
        Deuda: <b className="text-rose-600">{money(alumno.deuda)}</b> · Saldo:{' '}
        <b className="text-emerald-600">{money(alumno.saldo)}</b>
      </div>

      {enRevision && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
          <Hourglass size={15} className="mt-0.5 shrink-0 text-amber-500" />
          Ya tenés una transferencia en proceso de revisión. El kiosco debe acreditarla antes de
          informar otra.
        </p>
      )}

      <Select label="¿Qué querés hacer?" value={tipo} onChange={(e) => elegirTipo(e.target.value)}>
        <option value="deuda">Pagar deuda fiada</option>
        <option value="recarga">Recargar saldo</option>
      </Select>

      <Input
        label={tipo === 'deuda' ? 'Monto a pagar ($)' : 'Monto a cargar ($)'}
        inputMode="numeric"
        autoFocus
        value={monto}
        onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
        required
      />

      {puedeEfectivo ? (
        <Select label="Medio de pago" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
          <option value="transferencia">Transferencia</option>
          <option value="efectivo">Efectivo (en el kiosco)</option>
        </Select>
      ) : (
        <p className="flex items-start gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] text-indigo-700">
          <Landmark size={13} className="mt-0.5 shrink-0" />
          <span>
            Medio de pago: <b>Transferencia bancaria</b>. Queda pendiente hasta que el mostrador la
            acredite; el efectivo solo se recibe en el kiosco.
          </span>
        </p>
      )}

      {metodoPago === 'transferencia' ? (
        <>
          {/* Datos institucionales para transferir */}
          <div className="flex flex-col gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-400">
              <Landmark size={12} /> Datos para transferir
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-indigo-400">Alias</p>
                <p className="truncate font-mono text-sm font-bold text-indigo-800">{config.aliasPago}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => copiar(config.aliasPago, 'alias')}>
                {copiado === 'alias' ? <Check size={13} /> : <Copy size={13} />} Copiar
              </Button>
            </div>
            {config.cbuPago && (
              <div className="flex items-center justify-between gap-3 border-t border-indigo-100 pt-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-indigo-400">CBU</p>
                  <p className="truncate font-mono text-sm font-bold text-indigo-800">{config.cbuPago}</p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => copiar(config.cbuPago, 'cbu')}>
                  {copiado === 'cbu' ? <Check size={13} /> : <Copy size={13} />} Copiar
                </Button>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Al confirmar se registra tu aviso y se abre WhatsApp para adjuntar el comprobante al
            kiosco ({config.whatsapp}). El dinero se acredita cuando el mostrador lo verifique.
          </p>

          <Button
            type="submit"
            disabled={busy || montoNum <= 0 || enRevision}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            size="lg"
          >
            <MessageCircle size={17} />{' '}
            {busy ? 'Registrando…' : 'Confirmar y enviar comprobante'}
          </Button>
        </>
      ) : (
        <>
          <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
            <Banknote size={13} className="mt-0.5 shrink-0" />
            El pago en efectivo se acredita de inmediato, como si lo recibiera el mostrador. Se aplica
            primero a los fiados más antiguos; el excedente va al saldo.
          </p>
          <Button type="submit" variant="secondary" disabled={busy || montoNum <= 0 || enRevision} className="w-full">
            <HandCoins size={15} /> {busy ? 'Registrando…' : 'Confirmar pago en efectivo'}
          </Button>
        </>
      )}
    </form>
  )
}
