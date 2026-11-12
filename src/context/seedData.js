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
      nombreKiosco: 'Kiosco San Martín',
      colegio: 'Escuela N°12 "Gral. San Martín"',
      contacto: 'kiosco@sanmartin.edu.ar · 11 5555-0123',
      horario: 'Lun a Vie · 7:45 a 13:00',
      whatsapp: '+5493881234567',
      aliasPago: 'KIOSCO.SANMARTIN.MP',
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

    alumnos: [
      {
        id: 'a1',
        nombre: 'María',
        apellido: 'González',
        dni: '45111222',
        pin: '1234',
        curso: '5° A',
        tutorId: 't1',
        saldo: 2500,
        deuda: 4000,
        avatar: 'unicornio',
        limiteDiario: 2000,
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
          { id: 'm1', fecha: hace(6, 8, 0), tipo: 'recarga', detalle: 'Recarga de saldo · Tutor', monto: 5000 },
        ],
      },
      {
        id: 'a2',
        nombre: 'Juan',
        apellido: 'González',
        dni: '46333444',
        pin: '4321',
        curso: '3° B',
        tutorId: 't1',
        saldo: 800,
        deuda: 1200,
        avatar: 'pelota',
        limiteDiario: 1500,
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
          { id: 'm6', fecha: hace(4, 9, 0), tipo: 'recarga', detalle: 'Recarga de saldo · Tutor', monto: 1000 },
          { id: 'm7', fecha: hace(0, 8, 5), tipo: 'abono', detalle: 'Pago de deuda · Efectivo', monto: -300 },
        ],
      },
      {
        id: 'a3',
        nombre: 'Sofía',
        apellido: 'Ramírez',
        dni: '47555666',
        pin: '1111',
        curso: '6° A',
        tutorId: 't2',
        saldo: 0,
        deuda: 0,
        avatar: 'estrella',
        limiteDiario: 0,
        fiados: [],
        movimientos: [
          { id: 'm8', fecha: hace(5, 10, 0), tipo: 'recarga', detalle: 'Recarga de saldo · Tutor', monto: 3000 },
        ],
      },
      {
        id: 'a4',
        nombre: 'Lautaro',
        apellido: 'Díaz',
        dni: '48222111',
        pin: '2222',
        curso: '4° C',
        tutorId: null,
        saldo: 5000,
        deuda: 4500,
        avatar: 'gorra',
        limiteDiario: 0,
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
        id: 'a5',
        nombre: 'Camila',
        apellido: 'Torres',
        dni: '49101010',
        pin: '1010',
        curso: '2° A',
        tutorId: 't2',
        saldo: 1200,
        deuda: 600,
        avatar: 'gato',
        limiteDiario: 1000,
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
          { id: 'm13', fecha: hace(7, 9, 30), tipo: 'recarga', detalle: 'Recarga de saldo · Tutor', monto: 1500 },
        ],
      },
    ],

    tutores: [
      { id: 't1', nombre: 'Carlos González', dni: '30123456', pin: '1234', telefono: '11 5555-1001', hijos: ['a1', 'a2'] },
      { id: 't2', nombre: 'Laura Ramírez', dni: '29888777', pin: '7777', telefono: '11 5555-1002', hijos: ['a3', 'a5'] },
    ],

    staff: [
      { id: 's1', usuario: 'admin', clave: '1234', nombre: 'Dirección / Administración', rol: 'admin' },
      { id: 's2', usuario: 'vendedor', clave: '1234', nombre: 'Marcos · Mostrador', rol: 'vendedor' },
    ],

    // Solicitudes de transferencia informadas por alumnos/tutores, a la espera
    // de que el mostrador las acredite ({id, alumnoId, nombre, monto, fechaHora, estado, origen}).
    pagosPendientes: [],

    // Feed del centro de notificaciones (campanita del TopBar):
    // {id, fecha, para: 'staff' | '<rol>:<id>', texto, tipo}.
    notificaciones: [],

    ventas: [
      {
        id: 'v4',
        fecha: hace(1, 11, 40),
        items: [{ productoId: 'p13', nombre: 'Cuaderno rayado A5', cantidad: 1, precio: 2400, costo: 1500 }],
        total: 2400,
        metodo: 'efectivo',
        alumnoId: null,
        alumnoNombre: null,
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
        alumnoId: 'a1',
        alumnoNombre: 'María González',
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
        alumnoId: null,
        alumnoNombre: null,
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
        alumnoId: null,
        alumnoNombre: null,
        vendedor: 'vendedor',
        anulada: false,
      },
    ],
  }
}
