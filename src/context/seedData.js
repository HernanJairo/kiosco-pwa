export const CATEGORIAS = ['Bebidas', 'Snacks', 'Galletitas', 'Almuerzos', 'Útiles']

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
      horario: 'Lun a Sáb · 8:00 a 20:00',
      whatsapp: '+5493881234567',
      aliasPago: 'KIOSCO.LOSPINOS.MP',
      cbuPago: '0000003100012345678901',
      limiteFiadoGlobal: 10000,
      abierto: true,
    },

    productos: [
      { id: 'p1', nombre: 'Agua mineral 500 ml', categoria: 'Bebidas', costo: 400, precio: 700, stock: 24, stockMin: 6, vencimiento: d(120), codigos: ['7790895000997', '7790895001000'] },
      { id: 'p2', nombre: 'Gaseosa cola 354 ml', categoria: 'Bebidas', costo: 500, precio: 900, stock: 18, stockMin: 6, vencimiento: d(90), codigos: ['7791813420015'] },
      { id: 'p3', nombre: 'Jugo en caja naranja', categoria: 'Bebidas', costo: 250, precio: 450, stock: 3, stockMin: 8, vencimiento: d(15) },
      { id: 'p4', nombre: 'Papas fritas clásicas', categoria: 'Snacks', costo: 600, precio: 1100, stock: 15, stockMin: 5, vencimiento: d(40), codigos: ['7790310655620'] },
      { id: 'p5', nombre: 'Nachos con queso', categoria: 'Snacks', costo: 700, precio: 1200, stock: 10, stockMin: 5, vencimiento: d(5) },
      { id: 'p6', nombre: 'Barrita de cereal', categoria: 'Snacks', costo: 350, precio: 600, stock: 20, stockMin: 6, vencimiento: d(30) },
      { id: 'p7', nombre: 'Galletitas con chispas', categoria: 'Galletitas', costo: 450, precio: 800, stock: 12, stockMin: 5, vencimiento: d(25) },
      { id: 'p8', nombre: 'Galletitas de avena', categoria: 'Galletitas', costo: 400, precio: 700, stock: 8, stockMin: 5, vencimiento: d(-2) },
      { id: 'p9', nombre: 'Alfajor triple', categoria: 'Galletitas', costo: 300, precio: 550, stock: 30, stockMin: 8, vencimiento: d(60), codigos: ['7790040114505'] },
      { id: 'p10', nombre: 'Sándwich jamón y queso', categoria: 'Almuerzos', costo: 900, precio: 1600, stock: 6, stockMin: 4, vencimiento: d(1) },
      { id: 'p11', nombre: 'Empanada de pollo', categoria: 'Almuerzos', costo: 800, precio: 1500, stock: 9, stockMin: 4, vencimiento: d(2) },
      { id: 'p12', nombre: 'Ensalada de frutas', categoria: 'Almuerzos', costo: 1000, precio: 1800, stock: 4, stockMin: 3, vencimiento: d(0) },
      { id: 'p13', nombre: 'Cuaderno rayado A5', categoria: 'Útiles', costo: 1500, precio: 2400, stock: 14, stockMin: 5, vencimiento: null },
      { id: 'p14', nombre: 'Lapicera tinta azul', categoria: 'Útiles', costo: 200, precio: 400, stock: 40, stockMin: 10, vencimiento: null },
      { id: 'p15', nombre: 'Regla plástica 30 cm', categoria: 'Útiles', costo: 350, precio: 600, stock: 5, stockMin: 10, vencimiento: null },
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

    staff: [
      { id: 's1', usuario: 'admin', clave: '1234', nombre: 'Dueña · Administración', rol: 'admin' },
      { id: 's2', usuario: 'vendedor', clave: '1234', nombre: 'Marcos · Mostrador', rol: 'vendedor' },
    ],

    // Bandeja de solicitudes del mostrador (campana del staff):
    //   RESET_PIN                → recupero de clave pedido desde el login
    //   TRANSFERENCIA_PENDIENTE  → comprobante informado por un cliente
    // {id, tipo, clienteId, nombre, monto?, tipoOperacion?, origen?, fechaHora, estado}
    // estado: 'pendiente' | 'aprobada' | 'descartada'
    solicitudes: [],

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
