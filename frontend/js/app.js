const API_BASE_URL = "http://localhost:3307";
const TOKEN_KEY = "cineuphoria_token";

const form = document.querySelector("#login-form");
const message = document.querySelector("#message");
const session = document.querySelector("#session");
const welcome = document.querySelector("#welcome");
const logoutButton = document.querySelector("#logout");

function showMessage(text = "") { message.textContent = text; }

function setLoggedOut() {
  localStorage.removeItem(TOKEN_KEY);
  form.classList.remove("hidden");
  session.classList.add("hidden");
  form.reset();
}

function setLoggedIn(email) {
  welcome.textContent = `Bienvenido ${email}`;
  form.classList.add("hidden");
  session.classList.remove("hidden");
  showMessage();
}

async function loadProfile(token) {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo validar la sesión");
  return data.user;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage();
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) return showMessage("Completa tu correo y contraseña.");

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) throw new Error(data.error || "No fue posible iniciar sesión");
    localStorage.setItem(TOKEN_KEY, data.token);
    const user = await loadProfile(data.token);
    setLoggedIn(user.email);
  } catch (error) {
    setLoggedOut();
    showMessage(error.message || "Ocurrió un error al iniciar sesión.");
  }
});

logoutButton.addEventListener("click", setLoggedOut);

(async function restoreSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    const user = await loadProfile(token);
    setLoggedIn(user.email);
  } catch {
    setLoggedOut();
  }
}());
