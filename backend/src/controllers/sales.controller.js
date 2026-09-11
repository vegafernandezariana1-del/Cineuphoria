const pool = require("../config/db");

async function getMovies(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT pelicula_id AS id, titulo, duracion_minutos, clasificacion, idioma, estado FROM pelicula WHERE estado = 'En cartelera' ORDER BY titulo`);
    res.json({ movies: rows });
  } catch (error) { next(error); }
}

async function getFunctions(req, res, next) {
  try {
    const peliculaId = Number(req.query.peliculaId);
    if (!Number.isInteger(peliculaId) || peliculaId <= 0) return res.status(400).json({ error: "peliculaId es obligatorio" });
    const [rows] = await pool.query(`
      SELECT f.funcion_id AS id, f.pelicula_id AS peliculaId, p.titulo,
             f.sala_id AS salaId, s.numero_sala AS numeroSala, s.nombre AS sala,
             f.fecha, f.hora_inicio AS horaInicio, f.hora_fin AS horaFin, f.precio, f.estado
      FROM funcion f
      INNER JOIN pelicula p ON p.pelicula_id = f.pelicula_id
      INNER JOIN sala s ON s.sala_id = f.sala_id
      WHERE f.pelicula_id = ? AND f.estado = 'Programada' AND p.estado = 'En cartelera' AND s.estado = 'Activa'
      ORDER BY f.fecha, f.hora_inicio
    `, [peliculaId]);
    res.json({ functions: rows });
  } catch (error) { next(error); }
}

async function getSeats(req, res, next) {
  try {
    const funcionId = Number(req.params.funcionId);
    if (!Number.isInteger(funcionId) || funcionId <= 0) return res.status(400).json({ error: "funcionId inválido" });
    const [functions] = await pool.query(`
      SELECT f.funcion_id AS id, f.sala_id AS salaId, s.nombre AS sala, s.numero_sala AS numeroSala,
             f.precio, f.fecha, f.hora_inicio AS horaInicio, p.titulo
      FROM funcion f INNER JOIN sala s ON s.sala_id = f.sala_id INNER JOIN pelicula p ON p.pelicula_id = f.pelicula_id
      WHERE f.funcion_id = ?
    `, [funcionId]);
    if (!functions.length) return res.status(404).json({ error: "Función no encontrada" });
    const fn = functions[0];
    const [rows] = await pool.query(`
      SELECT a.asiento_id AS id, a.fila, a.numero, a.tipo_asiento AS tipo,
             CASE WHEN e.entrada_id IS NULL THEN 'disponible' ELSE 'ocupado' END AS estado
      FROM asiento a
      LEFT JOIN entrada e ON e.asiento_id = a.asiento_id AND e.funcion_id = ?
      WHERE a.sala_id = ? AND a.estado = 'Activo'
      ORDER BY a.fila, a.numero
    `, [funcionId, fn.salaId]);
    res.json({ function: fn, seats: rows });
  } catch (error) { next(error); }
}

async function getProducts(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT producto_id AS id, nombre, categoria, precio, stock FROM producto WHERE estado = 'Activo' AND stock > 0 ORDER BY categoria, nombre`);
    res.json({ products: rows });
  } catch (error) { next(error); }
}

async function getPaymentMethods(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT metodo_pago_id AS id, nombre, descripcion FROM metodo_pago WHERE estado = 'Activo' ORDER BY nombre`);
    res.json({ paymentMethods: rows });
  } catch (error) { next(error); }
}

module.exports = { getMovies, getFunctions, getSeats, getProducts, getPaymentMethods };
