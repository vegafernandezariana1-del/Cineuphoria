# Cineuphoria

Aplicación full stack para el proceso de compra de entradas de cine de **Cineuphoria**. Esta primera entrega implementa una base segura y extensible: salud de MySQL, registro, inicio de sesión con JWT y una interfaz web de autenticación. El flujo de negocio previsto continúa con cliente → película → función → sala → asientos → tipo de entrada → productos → pago → venta → entradas → confirmación.

## Integrantes del equipo

- Por definir por el equipo del proyecto.

## Stack técnico

- Backend: Node.js, Express 5, mysql2 (pool de conexiones), bcrypt y JSON Web Token.
- Base de datos: MySQL, base de datos `cinephoria`.
- Frontend: HTML, CSS y JavaScript nativo con Fetch API.

## Requisitos previos

- Node.js 18 o superior y npm.
- MySQL 8 o compatible, ejecutándose y accesible desde el equipo.
- Un usuario MySQL con permisos sobre la base `cinephoria`.

## Instalación y configuración

1. Clone el repositorio y copie el archivo de variables:

   ```bash
   cp .env.example .env
   ```

   En Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Edite `.env` y complete únicamente los datos reales de su instancia MySQL. No suba ese archivo a Git.

3. Instale las dependencias del backend:

   ```bash
   cd backend
   npm install
   ```

## Creación de la base de datos

Cree la base y la tabla de usuarios con el script incluido:

```bash
mysql -u TU_USUARIO -p < backend/sql/init.sql
```

El script crea `cinephoria` y la tabla `Usuario` con un email único. Puede ejecutarlo de nuevo de forma segura gracias a `IF NOT EXISTS`.

## Ejecutar el backend

Desde la carpeta `backend`:

```bash
npm run dev
```

Para ejecución normal:

```bash
npm start
```

Por defecto escucha en `http://localhost:3307`.

## Ejecutar el frontend

Sirva la carpeta `frontend` con un servidor estático. Por ejemplo:

```bash
npx serve frontend
```

Abra la URL que muestre el comando. Si el backend no usa `http://localhost:3307`, ajuste `API_BASE_URL` en `frontend/js/app.js`.

## Endpoints y pruebas básicas

Comprobar que la API y MySQL se comunican:

```bash
curl http://localhost:3307/api/health
```

Respuesta esperada:

```json
{ "status": "ok", "db": "connected" }
```

Registrar un usuario:

```bash
curl -X POST http://localhost:3307/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@ejemplo.com","password":"ClaveSegura123"}'
```

Iniciar sesión:

```bash
curl -X POST http://localhost:3307/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@ejemplo.com","password":"ClaveSegura123"}'
```

Consultar el perfil (reemplace `TOKEN`):

```bash
curl http://localhost:3307/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

## Estructura

```text
backend/
  sql/init.sql
  src/config, controllers, middleware, routes
frontend/
  index.html
  css/styles.css
  js/app.js
```

## Siguiente módulo del dominio

La base está preparada para extenderse con endpoints y vistas del flujo de compra: cartelera y géneros, funciones y salas, disponibilidad/validación de asientos, tipos de entrada, productos, métodos de pago, ventas, entradas y confirmación. Las operaciones de venta deberán usar transacciones para evitar que un asiento se venda dos veces.
