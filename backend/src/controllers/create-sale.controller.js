const pool = require("../config/db");
const ENTRY_TYPES = new Set(["Adulto", "Niño", "Estudiante", "Adulto mayor"]);

async function createSale(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const body = req.body || {};
    const cliente = body.cliente;
    const funcionId = Number(body.funcionId);
    const metodoPagoId = Number(body.metodoPagoId);
    const entradas = Array.isArray(body.entradas) ? body.entradas : [];
    const productos = Array.isArray(body.productos) ? body.productos : [];

    if (!cliente?.nombre || !cliente?.apellido || !cliente?.ci) return res.status(400).json({ error: "Nombre, apellido y CI son obligatorios" });
    if (!Number.isInteger(funcionId) || funcionId <= 0) return res.status(400).json({ error: "funcionId inválido" });
    if (!Number.isInteger(metodoPagoId) || metodoPagoId <= 0) return res.status(400).json({ error: "metodoPagoId inválido" });
    if (!entradas.length) return res.status(400).json({ error: "Selecciona al menos un asiento" });
    if (entradas.some(x => !Number.isInteger(Number(x.asientoId)) || !ENTRY_TYPES.has(x.tipoEntrada))) return res.status(400).json({ error: "Entrada inválida" });

    const seatIds = entradas.map(x => Number(x.asientoId));
    if (new Set(seatIds).size !== seatIds.length) return res.status(400).json({ error: "No puedes repetir un asiento" });

    await connection.beginTransaction();
    const [fns] = await connection.query(`SELECT f.funcion_id, f.sala_id, f.precio, f.estado, s.estado AS sala_estado FROM funcion f INNER JOIN sala s ON s.sala_id=f.sala_id WHERE f.funcion_id=? FOR UPDATE`, [funcionId]);
    if (!fns.length) throw Object.assign(new Error("Función no encontrada"), { status: 404 });
    const fn = fns[0];
    if (fn.estado !== "Programada" || fn.sala_estado !== "Activa") throw Object.assign(new Error("La función no está disponible"), { status: 409 });

    const marks = seatIds.map(() => "?").join(",");
    const [seats] = await connection.query(`SELECT asiento_id FROM asiento WHERE sala_id=? AND estado='Activo' AND asiento_id IN (${marks}) FOR UPDATE`, [fn.sala_id, ...seatIds]);
    if (seats.length !== seatIds.length) throw Object.assign(new Error("Hay asientos inválidos para esta sala"), { status: 409 });
    const [taken] = await connection.query(`SELECT asiento_id FROM entrada WHERE funcion_id=? AND asiento_id IN (${marks}) FOR UPDATE`, [funcionId, ...seatIds]);
    if (taken.length) throw Object.assign(new Error("Uno o más asientos ya fueron vendidos"), { status: 409 });

    const [methods] = await connection.query(`SELECT metodo_pago_id FROM metodo_pago WHERE metodo_pago_id=? AND estado='Activo'`, [metodoPagoId]);
    if (!methods.length) throw Object.assign(new Error("Método de pago no disponible"), { status: 400 });

    let clienteId;
    const ci = String(cliente.ci).trim();
    const [clients] = await connection.query(`SELECT cliente_id FROM cliente WHERE ci=? FOR UPDATE`, [ci]);
    if (clients.length) {
      clienteId = clients[0].cliente_id;
      await connection.query(`UPDATE cliente SET nombre=?, apellido=?, telefono=?, email=? WHERE cliente_id=?`, [String(cliente.nombre).trim(), String(cliente.apellido).trim(), cliente.telefono || null, cliente.email || null, clienteId]);
    } else {
      const [result] = await connection.query(`INSERT INTO cliente (nombre, apellido, ci, telefono, email, fecha_registro, estado) VALUES (?, ?, ?, ?, ?, CURDATE(), 'Activo')`, [String(cliente.nombre).trim(), String(cliente.apellido).trim(), ci, cliente.telefono || null, cliente.email || null]);
      clienteId = result.insertId;
    }

    let productTotal = 0;
    const productDetails = [];
    for (const item of productos) {
      const productoId = Number(item.productoId);
      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(productoId) || productoId <= 0 || !Number.isInteger(cantidad) || cantidad <= 0) throw Object.assign(new Error("Producto o cantidad inválida"), { status: 400 });
      const [products] = await connection.query(`SELECT producto_id, nombre, precio, stock FROM producto WHERE producto_id=? AND estado='Activo' FOR UPDATE`, [productoId]);
      if (!products.length) throw Object.assign(new Error("Producto no disponible"), { status: 409 });
      const product = products[0];
      if (cantidad > product.stock) throw Object.assign(new Error(`Stock insuficiente para ${product.nombre}`), { status: 409 });
      const subtotal = Number(product.precio) * cantidad;
      productTotal += subtotal;
      productDetails.push({ ...product, cantidad, subtotal });
    }

    const entriesTotal = seatIds.length * Number(fn.precio);
    const subtotal = entriesTotal + productTotal;
    const [sale] = await connection.query(`INSERT INTO venta (cliente_id, empleado_id, metodo_pago_id, fecha_venta, subtotal, descuento, total, estado) VALUES (?, NULL, ?, NOW(), ?, 0, ?, 'Completada')`, [clienteId, metodoPagoId, subtotal, subtotal]);
    const ventaId = sale.insertId;

    try {
      for (const item of entradas) await connection.query(`INSERT INTO entrada (venta_id, funcion_id, asiento_id, tipo_entrada, precio, descuento, total) VALUES (?, ?, ?, ?, ?, 0, ?)`, [ventaId, funcionId, Number(item.asientoId), item.tipoEntrada, fn.precio, fn.precio]);
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") throw Object.assign(new Error("Un asiento acaba de ser vendido. Actualiza la sala e inténtalo de nuevo."), { status: 409 });
      throw error;
    }

    for (const product of productDetails) {
      await connection.query(`INSERT INTO detalle_venta_producto (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)`, [ventaId, product.producto_id, product.cantidad, product.precio, product.subtotal]);
      await connection.query(`UPDATE producto SET stock=stock-? WHERE producto_id=?`, [product.cantidad, product.producto_id]);
    }

    await connection.commit();
    const [tickets] = await pool.query(`SELECT e.entrada_id AS id, e.tipo_entrada AS tipoEntrada, e.total, a.fila, a.numero, p.titulo, f.fecha, f.hora_inicio AS horaInicio, s.nombre AS sala FROM entrada e INNER JOIN asiento a ON a.asiento_id=e.asiento_id INNER JOIN funcion f ON f.funcion_id=e.funcion_id INNER JOIN pelicula p ON p.pelicula_id=f.pelicula_id INNER JOIN sala s ON s.sala_id=f.sala_id WHERE e.venta_id=? ORDER BY a.fila,a.numero`, [ventaId]);
    res.status(201).json({ sale: { id: ventaId, subtotal, descuento: 0, total: subtotal, estado: "Completada" }, tickets, products: productDetails.map(p => ({ id: p.producto_id, nombre: p.nombre, cantidad: p.cantidad, subtotal: p.subtotal })) });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally { connection.release(); }
}

module.exports = { createSale };
