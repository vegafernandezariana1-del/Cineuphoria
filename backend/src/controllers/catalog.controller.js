const pool = require('../config/db');
const send = (sql, params, res, next) => pool.execute(sql, params).then(([rows]) => res.json(rows)).catch(next);
exports.movies = (req,res,next) => send("SELECT pelicula_id id,titulo,duracion_minutos duracionMinutos,clasificacion FROM pelicula WHERE estado='En cartelera' ORDER BY titulo",[],res,next);
exports.showtimes = (req,res,next) => send("SELECT f.funcion_id id,f.precio,CONCAT(f.fecha,'T',f.hora_inicio) fechaHora,s.nombre sala,f.estado FROM funcion f JOIN sala s ON s.sala_id=f.sala_id WHERE f.pelicula_id=? AND f.estado <> 'Cancelada' ORDER BY f.fecha,f.hora_inicio",[Number(req.query.movieId)],res,next);
exports.seats = (req,res,next) => send("SELECT a.asiento_id id,a.fila,a.numero,CASE WHEN e.entrada_id IS NULL THEN 'DISPONIBLE' ELSE 'VENDIDO' END estado FROM funcion f JOIN asiento a ON a.sala_id=f.sala_id LEFT JOIN entrada e ON e.funcion_id=f.funcion_id AND e.asiento_id=a.asiento_id WHERE f.funcion_id=? AND a.estado='Activo' ORDER BY a.fila,a.numero",[Number(req.params.id)],res,next);
exports.products = (req,res,next) => send("SELECT producto_id id,nombre,precio FROM producto WHERE estado='Activo' AND stock>0 ORDER BY nombre",[],res,next);
exports.payments = (req,res,next) => send("SELECT metodo_pago_id id,nombre FROM metodo_pago WHERE estado='Activo' ORDER BY nombre",[],res,next);
