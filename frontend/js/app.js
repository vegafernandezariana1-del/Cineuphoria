const API = ['3000', '3307'].includes(location.port) ? '' : `http://${location.hostname}:3000`;
const TOKEN = 'cineuphoria_token';
const state = { movies: [], movie: null, showtime: null, seats: [], chosenSeats: new Set(), products: [], quantities: {}, user: null, registering: false };
const $ = (selector) => document.querySelector(selector);
const money = (value) => `Bs ${Number(value || 0).toFixed(2)}`;
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(TOKEN)}` });

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || 'No se pudo completar la solicitud.');
  return data;
}
function showPurchase(text = '', success = false) { const el = $('#purchase-message'); el.textContent = text; el.style.color = success ? '#a9e8ba' : '#ffc6c6'; }
function renderSummary() {
  const tickets = state.chosenSeats.size * Number(state.showtime?.precio || 0);
  const extras = state.products.reduce((sum, p) => sum + (state.quantities[p.id] || 0) * Number(p.precio), 0);
  $('#summary').innerHTML = `<strong>${state.chosenSeats.size} entrada(s)</strong>: ${money(tickets)}<br>Extras: ${money(extras)}<hr>Total: <strong>${money(tickets + extras)}</strong>`;
  $('#buy-button').disabled = !state.showtime || !state.chosenSeats.size;
}
function renderSeats() {
  $('#seat-list').innerHTML = state.seats.map(s => `<button class="seat ${s.estado === 'VENDIDO' ? 'sold' : ''} ${state.chosenSeats.has(s.id) ? 'selected' : ''}" data-id="${s.id}" ${s.estado === 'VENDIDO' ? 'disabled' : ''}>${s.fila}${s.numero}</button>`).join('') || '<p class="muted">Elige una función para ver sus asientos.</p>';
  document.querySelectorAll('.seat:not(.sold)').forEach(b => b.onclick = () => { const id = Number(b.dataset.id); state.chosenSeats.has(id) ? state.chosenSeats.delete(id) : state.chosenSeats.add(id); renderSeats(); renderSummary(); });
}
function renderProducts() {
  $('#product-list').innerHTML = state.products.map(p => `<div class="product"><span>${p.nombre}<br><small>${money(p.precio)}</small></span><div class="quantity"><button data-id="${p.id}" data-change="-1">−</button><b>${state.quantities[p.id] || 0}</b><button data-id="${p.id}" data-change="1">+</button></div></div>`).join('') || '<p class="muted">No hay productos disponibles.</p>';
  document.querySelectorAll('[data-change]').forEach(b => b.onclick = () => { const id = Number(b.dataset.id), next = Math.max(0, (state.quantities[id] || 0) + Number(b.dataset.change)); state.quantities[id] = next; renderProducts(); renderSummary(); });
}
async function chooseMovie(id) {
  state.movie = state.movies.find(m => m.id === id); state.showtime = null; state.seats = []; state.chosenSeats.clear();
  $('#selected-movie').textContent = state.movie.titulo; document.querySelectorAll('.movie').forEach(x => x.classList.toggle('active', Number(x.dataset.id) === id));
  $('#showtime-list').innerHTML = '<span class="muted">Cargando funciones…</span>'; renderSeats(); renderSummary();
  try { const shows = await api(`/api/catalog/showtimes?movieId=${id}`); $('#showtime-list').innerHTML = shows.map(s => `<button class="chip" data-id="${s.id}">${new Date(s.fechaHora).toLocaleString('es-BO',{dateStyle:'short',timeStyle:'short'})} · ${s.sala} · ${money(s.precio)}</button>`).join('') || '<span class="muted">No hay funciones habilitadas para esta película.</span>'; document.querySelectorAll('.chip').forEach(b => b.onclick = () => chooseShowtime(shows.find(s => s.id === Number(b.dataset.id)), b)); } catch (e) { $('#showtime-list').textContent = e.message; }
}
async function chooseShowtime(show, button) {
  state.showtime = show; state.chosenSeats.clear(); document.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === button));
  try { state.seats = await api(`/api/catalog/showtimes/${show.id}/seats`); renderSeats(); renderSummary(); } catch (e) { showPurchase(e.message); }
}
function renderMovies() {
  $('#movie-list').innerHTML = state.movies.map(m => `<button class="movie" data-id="${m.id}"><div class="poster">${m.titulo}</div><div class="movie-info"><strong>${m.titulo}</strong><p>★ ${m.clasificacion || 'Cine'} · ${m.duracionMinutos || '?'} min</p><small>Elegir función</small></div></button>`).join('');
  document.querySelectorAll('.movie').forEach(b => b.onclick = () => { chooseMovie(Number(b.dataset.id)); document.querySelector('#compra').scrollIntoView({behavior:'smooth'}); });
}
function updateAccount() { $('#account-button').textContent = state.user ? `Salir · ${state.user.email}` : 'Iniciar sesión'; $('#customer-fields').classList.toggle('hidden', !state.user); }
async function restoreUser() { const token = localStorage.getItem(TOKEN); if (!token) return; try { state.user = (await api('/api/auth/me', {headers: authHeaders()})).user; updateAccount(); } catch { localStorage.removeItem(TOKEN); } }
function openAuth() { if (state.user) { localStorage.removeItem(TOKEN); state.user = null; updateAccount(); return; } $('#auth-dialog').showModal(); }
function setAuthMode(registering) { state.registering = registering; $('#auth-title').textContent = registering ? 'Crea tu cuenta' : 'Inicia sesión'; $('#auth-help').textContent = registering ? 'Luego completa tus datos de cliente al pagar.' : 'Necesitas una cuenta para confirmar la venta.'; $('#toggle-auth').textContent = registering ? 'Ya tengo una cuenta' : 'Crear una cuenta'; $('#auth-message').textContent = ''; }
async function loadCatalog() {
  try { const [movies, products, payments] = await Promise.all([api('/api/catalog/movies'), api('/api/catalog/products'), api('/api/catalog/payments')]); state.movies = movies; state.products = products; renderMovies(); renderProducts(); $('#payment-select').innerHTML = '<option value="">Elige una opción</option>' + payments.map(p => `<option value="${p.id}">${p.nombre}</option>`).join(''); $('#catalog-status').textContent = `${movies.length} película(s) disponible(s)`; } catch (e) { $('#catalog-status').textContent = `Error: ${e.message}`; }
}
$('#account-button').onclick = openAuth; $('#close-auth').onclick = () => $('#auth-dialog').close(); $('#toggle-auth').onclick = () => setAuthMode(!state.registering);
$('#auth-form').onsubmit = async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const body = {email: form.get('email').trim(), password: form.get('password')}; try { $('#auth-message').textContent = 'Procesando…'; if (state.registering) { await api('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); setAuthMode(false); $('#auth-message').textContent = 'Cuenta creada. Ahora inicia sesión.'; return; } const login = await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); localStorage.setItem(TOKEN,login.token); state.user = (await api('/api/auth/me',{headers:authHeaders()})).user; updateAccount(); $('#auth-dialog').close(); showPurchase('Sesión iniciada. Ya puedes confirmar la venta.', true); } catch(e) { $('#auth-message').textContent = e.message; } };
$('#buy-button').onclick = async () => { if (!state.user) return $('#auth-dialog').showModal(); const payment = Number($('#payment-select').value); if (!payment) return showPurchase('Elige un método de pago.'); const cliente = {nombre:$('#customer-name').value.trim(),apellido:$('#customer-lastname').value.trim(),ci:$('#customer-ci').value.trim(),telefono:$('#customer-phone').value.trim()}; const productos = Object.entries(state.quantities).filter(([,cantidad]) => cantidad > 0).map(([id,cantidad]) => ({id:Number(id),cantidad})); try { $('#buy-button').disabled = true; showPurchase('Registrando venta…'); const sale = await api('/api/sales',{method:'POST',headers:authHeaders(),body:JSON.stringify({funcionId:state.showtime.id,asientos:[...state.chosenSeats],productos,metodoPagoId:payment,cliente})}); showPurchase(`¡Venta #${sale.saleId} registrada! Total: ${money(sale.total)}.`,true); state.chosenSeats.clear(); state.quantities={}; state.seats = await api(`/api/catalog/showtimes/${state.showtime.id}/seats`); renderSeats(); renderProducts(); renderSummary(); } catch(e) { showPurchase(e.message); } finally { $('#buy-button').disabled = false; } };
(async()=>{ await restoreUser(); await loadCatalog(); renderSummary(); })();
