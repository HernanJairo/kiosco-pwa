import { useKiosco } from '../../context/KioscoContext'

/* Cinta de contingencia operativa: franja roja suave debajo del header
   cuando fiados y/o encargos están pausados. En funcionamiento normal no
   renderiza nada. Fluye en el layout (empuja el contenido, no superpone). */
export default function CintaContingencia() {
  const { config } = useKiosco()
  const sinFiados = config.fiadosActivos === false
  const sinEncargos = config.encargosActivos === false
  if (!sinFiados && !sinEncargos) return null

  const texto =
    sinFiados && sinEncargos
      ? 'Por el momento los fiados y encargos no están disponibles.'
      : sinFiados
        ? 'Por el momento los fiados no están disponibles.'
        : 'Por el momento los encargos online no están disponibles.'

  return (
    <div
      role="status"
      className="border-b border-red-200 bg-red-50 px-4 py-1.5 text-center text-xs font-medium text-red-700 sm:text-sm"
    >
      {texto}
    </div>
  )
}
