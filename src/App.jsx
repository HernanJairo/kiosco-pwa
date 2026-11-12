import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Boxes,
  CalendarClock,
  Clock,
  HandCoins,
  IdCard,
  KeyRound,
  LogIn,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Users,
  Wallet,
} from 'lucide-react'
import { useKiosco } from './context/KioscoContext'
import { waLink } from './utils/whatsapp'
import TopBar from './components/layout/TopBar'
import LandingHeader from './components/layout/LandingHeader'
import RoleNav from './components/layout/RoleNav'
import Footer from './components/layout/Footer'
import Badge from './components/ui/Badge'
import Modal from './components/ui/Modal'
import CatalogoPublico from './modulos/modulo1_catalogo_auth/CatalogoPublico'
import LoginPanel from './modulos/modulo1_catalogo_auth/LoginPanel'
import ProductosABM from './modulos/modulo2_productos/ProductosABM'
import StockRapido from './modulos/modulo2_productos/StockRapido'
import VencimientosPanel from './modulos/modulo3_vencimientos/VencimientosPanel'
import BilleteraCliente from './modulos/modulo4_clientes/BilleteraCliente'
import CarnetCliente from './modulos/modulo4_clientes/CarnetCliente'
import ClientesAdmin from './modulos/modulo4_clientes/ClientesAdmin'
import TerminalPOS from './modulos/modulo5_ventas/TerminalPOS'
import AuditoriaVentas from './modulos/modulo5_ventas/AuditoriaVentas'
import CobranzaClientes from './modulos/modulo5_ventas/CobranzaClientes'
import Dashboard from './modulos/modulo6_reportes/Dashboard'
import ConfiguracionKiosco, { PanelMiAcceso } from './modulos/admin/ConfiguracionKiosco'

const TABS = {
  cliente: [
    { key: 'catalogo', label: 'Catálogo', icon: Store },
    { key: 'billetera', label: 'Mi Billetera', icon: Wallet },
    { key: 'carnet', label: 'Mi Carnet', icon: IdCard },
  ],
  vendedor: [
    { key: 'pos', label: 'Terminal POS', icon: ShoppingCart },
    { key: 'cobranza', label: 'Cobranzas', icon: HandCoins },
    { key: 'stock', label: 'Stock Rápido', icon: Boxes },
    { key: 'catalogo', label: 'Catálogo', icon: Store },
    { key: 'cuenta', label: 'Mi Cuenta', icon: KeyRound },
  ],
  admin: [
    { key: 'config', label: 'Configuración', icon: Settings },
    { key: 'productos', label: 'Productos', icon: Package },
    { key: 'catalogo', label: 'Catálogo', icon: Store },
    { key: 'vencimientos', label: 'Vencimientos', icon: CalendarClock },
    { key: 'clientes', label: 'Clientes', icon: Users },
    { key: 'ventas', label: 'Ventas', icon: Receipt },
    { key: 'reportes', label: 'Reportes', icon: BarChart3 },
  ],
}

const MODULOS = {
  cliente: { catalogo: CatalogoPublico, billetera: BilleteraCliente, carnet: CarnetCliente },
  vendedor: { pos: TerminalPOS, cobranza: CobranzaClientes, stock: StockRapido, catalogo: CatalogoPublico, cuenta: PanelMiAcceso },
  admin: {
    config: ConfiguracionKiosco,
    productos: ProductosABM,
    catalogo: CatalogoPublico,
    vencimientos: VencimientosPanel,
    clientes: ClientesAdmin,
    ventas: AuditoriaVentas,
    reportes: Dashboard,
  },
}

export default function App() {
  const { session, clienteSesion, logout, config } = useKiosco()
  const [contactoOpen, setContactoOpen] = useState(false)
  const [vista, setVista] = useState('login') // 'login' | 'catalogo' (solo landing pública)
  const [tab, setTab] = useState(null)

  const rol = session?.rol
  const tabs = useMemo(() => (rol ? TABS[rol] : []), [rol])

  // Sesión huérfana (datos restablecidos): cerrar sesión
  useEffect(() => {
    if (rol === 'cliente' && clienteSesion === null) logout()
  }, [rol, clienteSesion, logout])

  /* ---------- Vista pública: bienvenida + login directo ---------- */
  if (!session) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <LandingHeader
          onContact={() => setContactoOpen(true)}
          onCatalog={() => setVista('catalogo')}
          enCatalogo={vista === 'catalogo'}
          onLogin={() => setVista('login')}
        />

        <main className="flex-1">
          {vista === 'login' ? (
            /* Bienvenida: login centrado, sin catálogo debajo */
            <section className="fade-in mx-auto flex min-h-[calc(100vh-14rem)] w-full max-w-7xl flex-col items-center justify-center gap-6 px-4 py-10">
              <div className="text-center">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                  Bienvenido/a a <span className="text-emerald-600">{config.nombreKiosco}</span>
                </h1>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-slate-400">
                  <Clock size={14} /> {config.horario}
                  <Badge tone={config.abierto ? 'emerald' : 'amber'} className="ml-2">
                    {config.abierto ? 'Abierto ahora' : 'Cerrado'}
                  </Badge>
                </p>
              </div>
              <div className="w-full max-w-md">
                <LoginPanel />
              </div>
            </section>
          ) : (
            /* Catálogo público: vista dedicada con regreso al login */
            <section className="fade-in mx-auto w-full max-w-7xl px-4 pb-16 pt-6">
              <button
                onClick={() => setVista('login')}
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-emerald-600"
              >
                <LogIn size={15} /> Volver al ingreso
              </button>
              <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 p-6 text-white shadow-md sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold sm:text-2xl">Catálogo del kiosco</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-100">
                    <Store size={14} /> {config.direccion}
                  </p>
                </div>
                <Badge tone="white" className="w-fit">
                  {config.abierto ? 'Abierto ahora' : 'Cerrado'}
                </Badge>
              </div>
              <CatalogoPublico />
            </section>
          )}
        </main>

        <Footer />

        <Modal open={contactoOpen} onClose={() => setContactoOpen(false)} title="Contacto">
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">{config.nombreKiosco}</p>
            <p className="flex items-center gap-2">
              <MapPin size={15} className="shrink-0 text-emerald-600" /> {config.direccion}
            </p>
            <p className="flex items-center gap-2">
              <Phone size={15} className="shrink-0 text-emerald-600" /> {config.contacto}
            </p>
            <p className="flex items-center gap-2">
              <MessageCircle size={15} className="shrink-0 text-emerald-600" />
              <a
                href={waLink(config.whatsapp, `Hola! Consulta para ${config.nombreKiosco}.`)}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800"
              >
                WhatsApp: {config.whatsapp}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Clock size={15} className="shrink-0 text-emerald-600" /> {config.horario}
            </p>
          </div>
        </Modal>
      </div>
    )
  }

  /* ---------- Vista autenticada por rol ---------- */
  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key
  const Modulo = MODULOS[rol]?.[active]

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <TopBar />
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        <RoleNav items={tabs} active={active} onChange={setTab} />
        <main className="min-w-0 flex-1 pb-24 lg:pb-4">
          <div key={active} className="fade-in">
            {Modulo ? <Modulo /> : null}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
