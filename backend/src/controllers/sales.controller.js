const pool = require('../config/db');

exports.create = async (req, res, next) => {
  const c = await pool.getConnection();
  try {
    const { funcionId, asientos, productos = [], metodoPagoId, cliente = {} } = req.body || {};
    const seatIds = [...new Set((asientos || []).map(Number).filter(Number.isInteger))];
    if (!Number(funcionId) || !seatIds.length || !Number(metodoPagoId)) {
      return res.status(400).json({ error: 'Selecciona función, asientos y método de pago.' });
    }

    await c.beginTransaction();
    const [[user]] = await c.execute('SELECT email FROM Usuario WHERE id=?', [req.user.id]);
    let [[customer]] = await c.execute("SELECT cliente_id FROM cliente WHERE email=? AND estado='Activo'", [user.email]);
    if (!customer) {
      const { nombre, apellido, ci, telefono = '' } = cliente;
      if (!nombre || !apellido || !ci) {
        throw Object.assign(Error('Completa tu nombre, apellido y CI para registrar la venta.'), { statusCode: 400 });
      }
      const [created] = await c.execute(
        "INSERT INTO cliente(nombre,apellido,ci,telefono,email,fecha_registro,estado) VALUES(?,?,?,?,?,CURDATE(),'Activo')",
        [String(nombre).trim(), String(apellido).trim(), String(ci).trim(), String(telefono).trim(), user.email]
      );
      customer = { cliente_id: created.insertId };
    }

    const [[payment]] = await c.execute("SELECT metodo_pago_id FROM metodo_pago WHERE metodo_pago_id=? AND estado='Activo'", [metodoPagoId]);
    if (!payment) throw Object.assign(Error('Método de pago no disponible.'), { statusCode: 400 });
    const [[showtime]] = await c.execute("SELECT precio FROM funcion WHERE funcion_id=? AND estado <> 'Cancelada' FOR UPDATE", [funcionId]);
    if (!showtime) throw Object.assign(Error('Función no disponible.'), { statusCode: 400 });

    const marks = seatIds.map(() => '?').join(',');
    const [taken] = await c.execute(`SELECT asiento_id FROM entrada WHERE funcion_id=? AND asiento_id IN (${marks}) FOR UPDATE`, [funcionId, ...seatIds]);
    if (taken.length) throw Object.assign(Error('Uno de los asientos acaba de ser vendido. Elige otro.'), { statusCode: 409 });

    const orderedProducts = new Map();
    for (const item of productos) {
      const id = Number(item.id), cantidad = Number(item.cantidad);
      if (Number.isInteger(id) && Number.isInteger(cantidad) && cantidad > 0) orderedProducts.set(id, (orderedProducts.get(id) || 0) + cantidad);
    }
    let total = Number(showtime.precio) * seatIds.length;
    const productRows = [];
    for (const [id, cantidad] of orderedProducts) {
      const [[product]] = await c.execute("SELECT producto_id,nombre,precio,stock FROM producto WHERE producto_id=? AND estado='Activo' FOR UPDATE", [id]);
      if (!product || product.stock < cantidad) throw Object.assign(Error('Un producto ya no tiene stock suficiente.'), { statusCode: 409 });
      const subtotal = Number(product.precio) * cantidad;
      total += subtotal;
      productRows.push({ ...product, cantidad, subtotal });
    }

    const [sale] = await c.execute(
      "INSERT INTO venta(cliente_id,empleado_id,metodo_pago_id,fecha_venta,subtotal,descuento,total,estado) VALUES(?,NULL,?,NOW(),?,0,?,'Completada')",
      [customer.cliente_id, metodoPagoId, total, total]
    );
    for (const id of seatIds) await c.execute(
      "INSERT INTO entrada(venta_id,funcion_id,asiento_id,tipo_entrada,precio,descuento,total) VALUES(?,?,?,'Adulto',?,0,?)",
      [sale.insertId, funcionId, id, showtime.precio, showtime.precio]
    );
    for (const product of productRows) {
      await c.execute("INSERT INTO detalle_venta_producto(venta_id,producto_id,cantidad,precio_unitario,subtotal) VALUES(?,?,?,?,?)", [sale.insertId, product.producto_id, product.cantidad, product.precio, product.subtotal]);
      await c.execute('UPDATE producto SET stock=stock-? WHERE producto_id=?', [product.cantidad, product.producto_id]);
    }
    await c.commit();
    res.status(201).json({ saleId: sale.insertId, total, message: 'Venta registrada correctamente.' });
  } catch (error) {
    await c.rollback();
    next(error);
  } finally { c.release(); }
};
