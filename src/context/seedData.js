export const CATEGORIAS = ['Bebidas', 'Snacks', 'Galletitas', 'Almuerzos', 'Útiles']

// Fotos reales de producto (Unsplash, optimizadas a 400px). Si alguna
// falla al cargar, ProductoImg muestra el ícono de la categoría.
const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=80`

const d = (n) => {
  const t = new Date()
  t.setDate(t.getDate() + n)
  return t.toISOString().slice(0, 10)
}
const hoy = (h, m = 0) => {
  const t = new Date()
  t.setHours(h, m, 0, 0)
  return t.toISOString()
}
const hace = (dias, h = 12, m = 0) => {
  const t = new Date()
  t.setDate(t.getDate() - dias)
  t.setHours(h, m, 0, 0)
  return t.toISOString()
}

export function buildSeed() {
  return {
    config: {
      nombreKiosco: 'Kiosco Los Pinos',
      direccion: 'Av. Rivadavia 1234 · Local 2',
      contacto: 'kioscolospinos@gmail.com · 388 555-0123',
      emailKiosco: 'kioscolospinos@gmail.com',
      horario: 'Lun a Sáb · 8:00 a 20:00',
      whatsapp: '+5493881234567',
      aliasPago: 'KIOSCO.LOSPINOS.MP',
      cbuPago: '0000003100012345678901',
      limiteFiadoGlobal: 10000,
      // Regla antifraude del fiado: el cliente desbloquea su Cuenta
      // Corriente al juntar comprasMinimasParaFiado compras Y
      // montoMinimoParaFiado acumulado; el admin puede ajustarlos.
      comprasMinimasParaFiado: 10,
      montoMinimoParaFiado: 20000,
      limiteFiadoInicialDesbloqueado: 10000,
      abierto: true,
      // Interruptores de contingencia operativa: el staff puede pausar
      // fiados o encargos sin cerrar el local (todo queda auditado).
      fiadosActivos: true,
      encargosActivos: true,
      recibiendoEncargos: true,
    },

    productos: [
      { id: 'p1', nombre: 'Agua mineral 500 ml', descripcion: 'Botella sin gas, fresca', categoria: 'Bebidas', costo: 400, precio: 700, stock: 24, stockMin: 6, vencimiento: d(120), codigos: ['7790895000997', '7790895001000'], foto: img('photo-1523362628745-0c100150b504') },
      { id: 'p2', nombre: 'Gaseosa cola 354 ml', descripcion: 'Botella descartable bien fría', categoria: 'Bebidas', costo: 500, precio: 900, stock: 18, stockMin: 6, vencimiento: d(90), codigos: ['7791813420015'], foto: img('photo-1554866585-cd94860890b7') },
      { id: 'p3', nombre: 'Jugo en caja naranja', descripcion: 'Pack individual 200 ml', categoria: 'Bebidas', costo: 250, precio: 450, stock: 3, stockMin: 8, vencimiento: d(15), foto: img('photo-1556679343-c7306c1976bc') },
      { id: 'p4', nombre: 'Papas fritas clásicas', descripcion: 'Bolsa grande, corte tradicional', categoria: 'Snacks', costo: 600, precio: 1100, stock: 15, stockMin: 5, vencimiento: d(40), codigos: ['7790310655620'], foto: img('photo-1566478989037-eec170784d0b') },
      { id: 'p5', nombre: 'Nachos con queso', descripcion: 'Con cheddar derretido', categoria: 'Snacks', costo: 700, precio: 1200, stock: 10, stockMin: 5, vencimiento: d(5), foto: img('photo-1613919113640-25732ec5e61f') },
      { id: 'p6', nombre: 'Barrita de cereal', descripcion: 'Avena y miel, snack liviano', categoria: 'Snacks', costo: 350, precio: 600, stock: 20, stockMin: 6, vencimiento: d(30), foto: img('photo-1621939514649-280e2ee25f60') },
      { id: 'p7', nombre: 'Galletitas con chispas', descripcion: 'Paquete de cookies con chips', categoria: 'Galletitas', costo: 450, precio: 800, stock: 12, stockMin: 5, vencimiento: d(25), foto: img('photo-1499636136210-6f4ee915583e') },
      { id: 'p8', nombre: 'Galletitas de avena', descripcion: 'Pack x6, caseras', categoria: 'Galletitas', costo: 400, precio: 700, stock: 8, stockMin: 5, vencimiento: d(-2), foto: img('photo-1558961363-fa8fdf82db35') },
      { id: 'p9', nombre: 'Alfajor triple', descripcion: 'Chocolate y dulce de leche', categoria: 'Galletitas', costo: 300, precio: 550, stock: 30, stockMin: 8, vencimiento: d(60), codigos: ['7790040114505'], foto: img('photo-1549007994-cb92caebd54b') },
      { id: 'p10', nombre: 'Sándwich jamón y queso', descripcion: 'Pan lactal, fresco del día', categoria: 'Almuerzos', costo: 900, precio: 1600, stock: 6, stockMin: 4, vencimiento: d(1), foto: img('photo-1528735602780-2552fd46c7af') },
      { id: 'p11', nombre: 'Empanada de pollo', descripcion: 'Al horno, jugosa', categoria: 'Almuerzos', costo: 800, precio: 1500, stock: 9, stockMin: 4, vencimiento: d(2), foto: img('photo-1601050690597-df0568f70950') },
      { id: 'p12', nombre: 'Ensalada de frutas', descripcion: 'Vaso con fruta de estación', categoria: 'Almuerzos', costo: 1000, precio: 1800, stock: 4, stockMin: 3, vencimiento: d(0), foto: img('photo-1490474418585-ba9bad8fd0ea') },
      { id: 'p13', nombre: 'Cuaderno rayado A5', descripcion: 'Tapa blanda, 80 hojas', categoria: 'Útiles', costo: 1500, precio: 2400, stock: 14, stockMin: 5, vencimiento: null, foto: img('photo-1531346878377-a5be20888e57') },
      { id: 'p14', nombre: 'Lapicera tinta azul', descripcion: 'Trazo fino, escritura suave', categoria: 'Útiles', costo: 200, precio: 400, stock: 40, stockMin: 10, vencimiento: null, foto: img('photo-1585336261022-680e295ce3fe') },
      { id: 'p15', nombre: 'Regla plástica 30 cm', descripcion: 'Transparente, borde metálico', categoria: 'Útiles', costo: 350, precio: 600, stock: 5, stockMin: 10, vencimiento: null, foto: img('photo-1452860606245-08befc0ff44b') },
    ],

    // Clientes registrados: el DNI es el identificador único de acceso.
    // saldo = plata a favor (adelanto) · deuda = fiado pendiente.
    // limiteFiado = tope propio de cuenta corriente (0 → usa el global del kiosco).
    clientes: [
      {
        id: 'c1',
        nombre: 'María',
        apellido: 'González',
        dni: '45111222',
        pin: '1234',
        telefono: '5493885551001',
        email: 'maria.gonzalez@correo.com',
        saldo: 2500,
        deuda: 4000,
        limiteFiado: 0,
        avatar: 'unicornio',
        fiados: [
          {
            id: 'f1',
            ventaId: null,
            fecha: hace(3, 9, 50),
            items: [
              { nombre: 'Gaseosa cola 354 ml', cantidad: 1, precio: 900 },
              { nombre: 'Papas fritas clásicas', cantidad: 1, precio: 1100 },
            ],
            monto: 2000,
            pendiente: 2000,
            pagado: false,
          },
          {
            id: 'f2',
            ventaId: 'v3',
            fecha: hoy(10, 32),
            items: [
              { nombre: 'Alfajor triple', cantidad: 2, precio: 550 },
              { nombre: 'Gaseosa cola 354 ml', cantidad: 1, precio: 900 },
            ],
            monto: 2000,
            pendiente: 2000,
            pagado: false,
          },
        ],
        movimientos: [
          { id: 'm4', fecha: hoy(10, 32), tipo: 'fiado', detalle: 'Compra fiada · 3 ítems', monto: 2000 },
          { id: 'm3', fecha: hace(2, 18, 15), tipo: 'abono', detalle: 'Pago de deuda · Transferencia', monto: -1500 },
          { id: 'm2', fecha: hace(3, 9, 50), tipo: 'fiado', detalle: 'Compra fiada · 2 ítems', monto: 2000 },
          { id: 'm1', fecha: hace(6, 8, 0), tipo: 'recarga', detalle: 'Recarga de saldo · Kiosco', monto: 5000 },
        ],
      },
      {
        id: 'c2',
        nombre: 'Juan',
        apellido: 'Pérez',
        dni: '46333444',
        pin: '4321',
        telefono: '5493885551002',
        email: '',
        saldo: 800,
        deuda: 1200,
        limiteFiado: 5000,
        avatar: 'pelota',
        fiados: [
          {
            id: 'f3',
            ventaId: null,
            fecha: hace(1, 12, 10),
            items: [{ nombre: 'Empanada de pollo', cantidad: 1, precio: 1500 }],
            monto: 1500,
            pendiente: 1200,
            pagado: false,
          },
        ],
        movimientos: [
          { id: 'm5', fecha: hace(1, 12, 10), tipo: 'fiado', detalle: 'Compra fiada · 1 ítem', monto: 1500 },
          { id: 'm6', fecha: hace(4, 9, 0), tipo: 'recarga', detalle: 'Recarga de saldo · Kiosco', monto: 1000 },
          { id: 'm7', fecha: hace(0, 8, 5), tipo: 'abono', detalle: 'Pago de deuda · Efectivo', monto: -300 },
        ],
      },
      {
        id: 'c3',
        nombre: 'Sofía',
        apellido: 'Ramírez',
        dni: '47555666',
        pin: '1111',
        telefono: '5493885551003',
        email: 'sofia.ramirez@correo.com',
        saldo: 0,
        deuda: 0,
        limiteFiado: 0,
        avatar: 'estrella',
        fiados: [],
        movimientos: [
          { id: 'm8', fecha: hace(5, 10, 0), tipo: 'recarga', detalle: 'Recarga de saldo · Kiosco', monto: 3000 },
        ],
      },
      {
        id: 'c4',
        nombre: 'Lautaro',
        apellido: 'Díaz',
        dni: '48222111',
        pin: '2222',
        telefono: '',
        email: '',
        saldo: 5000,
        deuda: 4500,
        limiteFiado: 8000,
        avatar: 'gorra',
        fiados: [
          {
            id: 'f4',
            ventaId: null,
            fecha: hace(8, 11, 20),
            items: [
              { nombre: 'Sándwich jamón y queso', cantidad: 1, precio: 1600 },
              { nombre: 'Jugo en caja naranja', cantidad: 1, precio: 450 },
              { nombre: 'Alfajor triple', cantidad: 1, precio: 550 },
            ],
            monto: 2600,
            pendiente: 2600,
            pagado: false,
          },
          {
            id: 'f5',
            ventaId: null,
            fecha: hace(2, 13, 5),
            items: [
              { nombre: 'Nachos con queso', cantidad: 1, precio: 1200 },
              { nombre: 'Gaseosa cola 354 ml', cantidad: 1, precio: 900 },
            ],
            monto: 2100,
            pendiente: 1900,
            pagado: false,
          },
        ],
        movimientos: [
          { id: 'm9', fecha: hace(2, 13, 5), tipo: 'fiado', detalle: 'Compra fiada · 2 ítems', monto: 2100 },
          { id: 'm10', fecha: hace(8, 11, 20), tipo: 'fiado', detalle: 'Compra fiada · 3 ítems', monto: 2600 },
          { id: 'm11', fecha: hace(9, 10, 0), tipo: 'recarga', detalle: 'Recarga de saldo · Kiosco', monto: 5000 },
        ],
      },
      {
        id: 'c5',
        nombre: 'Camila',
        apellido: 'Torres',
        dni: '49101010',
        pin: '1010',
        telefono: '5493885551005',
        email: '',
        saldo: 1200,
        deuda: 600,
        limiteFiado: 0,
        avatar: 'gato',
        fiados: [
          {
            id: 'f6',
            ventaId: null,
            fecha: hace(4, 12, 40),
            items: [{ nombre: 'Barrita de cereal', cantidad: 1, precio: 600 }],
            monto: 600,
            pendiente: 600,
            pagado: false,
          },
        ],
        movimientos: [
          { id: 'm12', fecha: hace(4, 12, 40), tipo: 'fiado', detalle: 'Compra fiada · 1 ítem', monto: 600 },
          { id: 'm13', fecha: hace(7, 9, 30), tipo: 'recarga', detalle: 'Recarga de saldo · Kiosco', monto: 1500 },
        ],
      },
    ],

    // Equipo del comercio (admins y vendedores): usuario = DNI o
    // username único · pin = 4 dígitos · avatarUrl = foto opcional
    // · activo = acceso habilitado.
    personal: [
      { id: 's1', usuario: 'admin', nombre: 'Dueña', apellido: 'Administración', rol: 'admin', pin: '1234', avatarUrl: '', activo: true, puesto: 'Administración' },
      { id: 's2', usuario: 'vendedor', nombre: 'Marcos', apellido: 'Mostrador', rol: 'vendedor', pin: '1234', avatarUrl: '', activo: true, puesto: 'Mostrador' },
    ],

    // Bandeja de solicitudes del mostrador (campana del staff):
    //   RESET_PIN                → recupero de clave pedido desde el login
    //   TRANSFERENCIA_PENDIENTE  → comprobante informado por un cliente
    // {id, tipo, clienteId, nombre, monto?, tipoOperacion?, origen?, fechaHora, estado}
    // estado: 'pendiente' | 'aprobada' | 'descartada'
    solicitudes: [],
    encargos: [],
    auditoria: [],

    // Feed del centro de notificaciones (campanita del TopBar):
    // {id, fecha, para: 'staff' | 'cliente:<id>', texto, tipo}.
    notificaciones: [],

    ventas: [
      {
        id: 'v4',
        fecha: hace(1, 11, 40),
        items: [{ productoId: 'p13', nombre: 'Cuaderno rayado A5', cantidad: 1, precio: 2400, costo: 1500 }],
        total: 2400,
        metodo: 'efectivo',
        clienteId: null,
        clienteNombre: null,
        vendedor: 'vendedor',
        anulada: false,
      },
      {
        id: 'v3',
        fecha: hoy(10, 32),
        items: [
          { productoId: 'p9', nombre: 'Alfajor triple', cantidad: 2, precio: 550, costo: 300 },
          { productoId: 'p2', nombre: 'Gaseosa cola 354 ml', cantidad: 1, precio: 900, costo: 500 },
        ],
        total: 2000,
        metodo: 'fiado',
        clienteId: 'c1',
        clienteNombre: 'María González',
        vendedor: 'vendedor',
        anulada: false,
      },
      {
        id: 'v2',
        fecha: hoy(10, 5),
        items: [
          { productoId: 'p10', nombre: 'Sándwich jamón y queso', cantidad: 1, precio: 1600, costo: 900 },
          { productoId: 'p3', nombre: 'Jugo en caja naranja', cantidad: 1, precio: 450, costo: 250 },
        ],
        total: 2050,
        metodo: 'transferencia',
        clienteId: null,
        clienteNombre: null,
        vendedor: 'vendedor',
        anulada: false,
      },
      {
        id: 'v1',
        fecha: hoy(9, 15),
        items: [
          { productoId: 'p1', nombre: 'Agua mineral 500 ml', cantidad: 2, precio: 700, costo: 400 },
          { productoId: 'p4', nombre: 'Papas fritas clásicas', cantidad: 1, precio: 1100, costo: 600 },
        ],
        total: 2500,
        metodo: 'efectivo',
        clienteId: null,
        clienteNombre: null,
        vendedor: 'vendedor',
        anulada: false,
      },
    ],
  }
}
