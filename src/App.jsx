import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Bell,
  Boxes,
  CalendarClock,
  ClipboardList,
  Clock,
  HandCoins,
  History,
  IdCard,
  KeyRound,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Package,
  PackageCheck,
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
import CintaContingencia from './components/ui/CintaContingencia'
import RoleNav from './components/layout/RoleNav'
import Footer from './components/layout/Footer'
import SplashScreen from './components/SplashScreen'
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
import EncargosPanel from './modulos/modulo5_ventas/EncargosPanel'
import NotificacionesPanel from './modulos/modulo5_ventas/NotificacionesPanel'
import MisEncargos from './modulos/modulo4_clientes/MisEncargos'
import HistorialCliente from './modulos/modulo4_clientes/HistorialCliente'
import SoporteCliente from './modulos/modulo4_clientes/SoporteCliente'
import ReportesAdmin from './modulos/modulo6_reportes/ReportesAdmin'
import ConfiguracionKiosco, { PanelMiAcceso } from './modulos/admin/ConfiguracionKiosco'

const TABS = {
  cliente: [
    { key: 'catalogo', label: 'Catálogo', icon: Store },
    { key: 'billetera', label: 'Mi Billetera', icon: Wallet },
    { key: 'encargos', label: 'Mis Encargos', icon: PackageCheck },
    { key: 'carnet', label: 'Mi Carnet', icon: IdCard },
    { key: 'historial', label: 'Historial', icon: History },
    { key: 'soporte', label: 'Soporte', icon: LifeBuoy },
  ],
  vendedor: [
    { key: 'pos', label: 'Terminal POS', icon: ShoppingCart },
    { key: 'cobranza', label: 'Cobranzas', icon: HandCoins },
    { key: 'encargos', label: 'Encargos', icon: PackageCheck },
    { key: 'stock', label: 'Stock Rápido', icon: Boxes },
    { key: 'catalogo', label: 'Catálogo', icon: Store },
    { key: 'clientes', label: 'Clientes', icon: Users },
    { key: 'ventas', label: 'Ventas', icon: Receipt },
    { key: 'actividad', label: 'Mi Actividad', icon: ClipboardList },
    { key: 'cuenta', label: 'Mi Cuenta', icon: KeyRound },
  ],
  admin: [
    // Paridad total con el mostrador: el admin opera igual que el
    // vendedor (POS, cobranzas, stock, encargos) más su gestión propia.
    { key: 'pos', label: 'Terminal POS', icon: ShoppingCart },
    { key: 'cobranza', label: 'Cobranzas', icon: HandCoins },
    { key: 'encargos', label: 'Encargos', icon: PackageCheck },
    { key: 'stock', label: 'Stock Rápido', icon: Boxes },
    { key: 'config', label: 'Configuración', icon: Settings },
    { key: 'productos', label: 'Productos', icon: Package },
    { key: 'catalogo', label: 'Catálogo', icon: Store },
    { key: 'vencimientos', label: 'Vencimientos', icon: CalendarClock },
    { key: 'clientes', label: 'Clientes', icon: Users },
    { key: 'ventas', label: 'Ventas', icon: Receipt },
    { key: 'notifs', label: 'Notificaciones', icon: Bell },
    { key: 'reportes', label: 'Reportes', icon: BarChart3 },
  ],
}

const MODULOS = {
  cliente: { catalogo: CatalogoPublico, billetera: BilleteraCliente, encargos: MisEncargos, carnet: CarnetCliente, historial: HistorialCliente, soporte: SoporteCliente },
  vendedor: { pos: TerminalPOS, cobranza: CobranzaClientes, encargos: EncargosPanel, stock: StockRapido, catalogo: CatalogoPublico, clientes: ClientesAdmin, ventas: AuditoriaVentas, actividad: NotificacionesPanel, cuenta: PanelMiAcceso },
  admin: {
    pos: TerminalPOS,
    cobranza: CobranzaClientes,
    encargos: EncargosPanel,
    stock: StockRapido,
    config: ConfiguracionKiosco,
    productos: ProductosABM,
    catalogo: CatalogoPublico,
    vencimientos: VencimientosPanel,
    clientes: ClientesAdmin,
    ventas: AuditoriaVentas,
    notifs: NotificacionesPanel,
    reportes: ReportesAdmin,
  },
}

export default function App() {
  const { session, clienteSesion, logout, config } = useKiosco()
  const [contactoOpen, setContactoOpen] = useState(false)
  const [vista, setVista] = useState('login') // 'login' | 'catalogo' (solo landing pública)
  const [tab, setTab] = useState(null)
  const [navOpen, setNavOpen] = useState(false) // cajón lateral del menú (mobile/tablet)
  // Splash de bienvenida: una sola vez por sesión de pestaña.
  const [splash, setSplash] = useState(() => {
    try {
      return !sessionStorage.getItem('yapa_splash_ok')
    } catch {
      return false
    }
  })
  const cerrarSplash = () => {
    try {
      sessionStorage.setItem('yapa_splash_ok', '1')
    } catch { /* sin storage: simplemente no vuelve a mostrarse en esta sesión */ }
    setSplash(false)
  }
  const splashEl = splash ? <SplashScreen onFin={cerrarSplash} /> : null

  const rol = session?.rol
  const tabs = useMemo(() => (rol ? TABS[rol] : []), [rol])

  // Sesión huérfana (datos restablecidos): cerrar sesión
  useEffect(() => {
    if (rol === 'cliente' && clienteSesion === null) logout()
  }, [rol, clienteSesion, logout])

  // Navegación interna entre módulos (ej. "Catálogo" desde la billetera)
  useEffect(() => {
    const onNav = (e) => {
      const destino = e.detail
      if (tabs.some((t) => t.key === destino)) setTab(destino)
    }
    window.addEventListener('yapa:nav', onNav)
    return () => window.removeEventListener('yapa:nav', onNav)
  }, [tabs])

  // "Ingresar" desde el catálogo público (visitante → vista de login)
  useEffect(() => {
    const onLogin = () => setVista('login')
    window.addEventListener('yapa:login', onLogin)
    return () => window.removeEventListener('yapa:login', onLogin)
  }, [])

  /* ---------- Vista pública: bienvenida + login directo ---------- */
  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col overflow-x-hidden bg-white">
        {splashEl}
        <LandingHeader
          onContact={() => setContactoOpen(true)}
          onCatalog={() => setVista('catalogo')}
          enCatalogo={vista === 'catalogo'}
          onLogin={() => setVista('login')}
        />
        <CintaContingencia />

        <main className="flex-1">
          {vista === 'login' ? (
            /* Bienvenida: split-login centrado, sin catálogo debajo */
            <section className="fade-in mx-auto flex min-h-[calc(100vh-14rem)] w-full max-w-5xl flex-col items-center justify-center gap-6 px-4 py-10">
              <LoginPanel />
            </section>
          ) : (
            /* Catálogo público: el header del landing ya ofrece "Ingresar",
                así que el contenido sube sin banners ni duplicados. */
            <section className="fade-in mx-auto w-full max-w-7xl px-4 pb-16">
              <CatalogoPublico />
            </section>
          )}
        </main>

        <Footer />

        <Modal open={contactoOpen} onClose={() => setContactoOpen(false)} title="Contacto">
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">{config.nombreKiosco}</p>
            <p className="flex items-center gap-2">
              <MapPin size={15} className="shrink-0 text-brand" /> {config.direccion}
            </p>
            <p className="flex items-center gap-2">
              <Phone size={15} className="shrink-0 text-brand" /> {config.contacto}
            </p>
            <p className="flex items-center gap-2">
              <MessageCircle size={15} className="shrink-0 text-brand" />
              <a
                href={waLink(config.whatsapp, `Hola! Consulta para ${config.nombreKiosco}.`)}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand underline decoration-blue-300 underline-offset-2 hover:text-brand-dark"
              >
                WhatsApp: {config.whatsapp}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Clock size={15} className="shrink-0 text-brand" /> {config.horario}
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
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-white">
      {splashEl}
      <TopBar onMenu={() => setNavOpen(true)} />
      <CintaContingencia />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 gap-6 px-4 py-6">
        <RoleNav
          items={tabs}
          active={active}
          onChange={setTab}
          open={navOpen}
          onClose={() => setNavOpen(false)}
        />
        <main className="min-w-0 flex-1 pb-24 xl:pb-6">
          <div key={active} className="fade-in">
            {Modulo ? <Modulo /> : null}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
