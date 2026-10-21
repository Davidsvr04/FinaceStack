# FinaceStack

Aplicación web de gestión de finanzas personales: ingresos y gastos, metas de ahorro, tarjetas de crédito y un dashboard con analítica del mes.

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS 4, Recharts, React Router.
- **Backend:** Node.js 22+ con Express 5 y TypeScript, autenticación con `@supabase/server`.
- **Base de datos y auth:** Supabase (PostgreSQL con Row Level Security).

## Estructura

```
.
├── supabase/
│   └── migrations/20261016000000_init.sql   # tablas, triggers, RPC, RLS y semillas
├── backend/
│   └── src/
│       ├── index.ts                # arranque (valida env y levanta el servidor)
│       ├── app.ts                  # Express: CORS, JSON, routers, errores
│       ├── config/env.ts
│       ├── middleware/auth.ts      # requireUser / requireAdmin con @supabase/server
│       ├── middleware/error.ts
│       ├── lib/http.ts             # HttpError, validación zod, mapeo de errores de Postgres
│       ├── lib/finance.ts          # fechas de corte/pago, simulación de pago de deuda
│       ├── routes/                 # accounts, categories, transactions, savings,
│       │                           # credit-cards, dashboard, admin
│       └── types/express.d.ts
└── frontend/
    └── src/
        ├── main.tsx, App.tsx       # rutas públicas, protegidas y de admin
        ├── context/AuthContext.tsx # sesión de Supabase Auth + perfil/rol
        ├── lib/                    # cliente supabase, cliente del API, formato
        ├── hooks/useApi.ts
        ├── components/
        │   ├── layout/AppLayout.tsx    # menú lateral (PC) / barra inferior (móvil)
        │   ├── ProtectedRoute.tsx
        │   └── dashboard/              # StatCard, DebtMeter, gráficos, últimos movimientos
        └── pages/                  # Login, Dashboard, Movimientos, Cuentas, Ahorros, Tarjetas, Admin
```

## Puesta en marcha

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta [supabase/migrations/20261016000000_init.sql](supabase/migrations/20261016000000_init.sql) en el SQL Editor, o con `supabase db push` si usas la CLI.
3. Copia las llaves desde **Project Settings → API Keys**: la *publishable* (`sb_publishable_...`) y la *secret* (`sb_secret_...`).

### 2. Backend

```bash
cd backend
cp .env.example .env   # completa SUPABASE_URL, llaves y SUPABASE_JWKS_URL
npm install
npm run dev            # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # SUPABASE_URL, publishable key y URL del API
npm install
npm run dev            # http://localhost:5173
```

### 4. Primer administrador

Regístrate desde la app y ejecuta en el SQL Editor:

```sql
update public.users_profiles set role = 'admin' where id = '<uuid-del-usuario>';
```

Después, los administradores pueden cambiar roles desde el API (`PATCH /api/admin/users/:id/role`).

## Modelo de datos

| Tabla | Descripción |
|---|---|
| `users_profiles` | Perfil, rol (`user` / `admin`) y `uses_usd` (apartado de dólares activado). Se crea automáticamente al registrarse. |
| `accounts` | Cuentas `bank`, `cash` o `credit_card`, en `COP` (por defecto) o `USD`. Las tarjetas tienen cupo, día de corte, día de pago y tasa mensual, y siempre son en pesos. |
| `categories` | Categorías de ingreso o gasto. Las globales tienen `user_id` nulo y cada usuario puede crear las suyas. |
| `transactions` | Ingresos y gastos. Un trigger actualiza el saldo de la cuenta. |
| `savings_goals` | Metas de ahorro con monto objetivo, acumulado y fecha límite. |

**Saldos:** en cuentas `bank` y `cash` el saldo positivo es dinero disponible. En tarjetas el saldo negativo es deuda. Un pago a tarjeta (`pay_credit_card`) se registra como transferencia: dos transacciones enlazadas por `transfer_id`, que no cuentan como ingreso ni como gasto en la analítica.

**Dólares:** las cuentas en `USD` se llevan en un apartado aparte (`/dolares`) que cada usuario activa desde Cuentas. El dashboard, las tarjetas, las metas de ahorro y Movimientos solo usan cuentas en pesos, así que quien no maneja dólares no ve ningún cambio. Comprar o vender dólares (`exchange_currency`) es una transferencia entre una cuenta en pesos y una en dólares con un monto en cada moneda; las dos patas guardan la tasa (pesos por dólar) en `exchange_rate` y no cuentan como ingreso ni gasto. Las transferencias entre cuentas solo se permiten entre cuentas de la misma moneda.

**Seguridad:** todas las tablas tienen RLS y cada usuario solo ve sus datos. El rol no se puede editar desde el cliente, porque solo `full_name` tiene permiso de `UPDATE`. Las rutas de administración usan la secret key en el backend y solo devuelven métricas agregadas y datos de usuarios, nunca transacciones individuales.

## API

Todas las rutas, salvo `/api/health`, requieren `Authorization: Bearer <access_token de Supabase>`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servicio |
| GET/POST | `/api/accounts` | Listar (`?currency=COP\|USD\|all`, por defecto `COP`) / crear cuentas (incluye tarjetas; `currency` al crear) |
| PATCH/DELETE | `/api/accounts/:id` | Editar / eliminar cuenta |
| GET/POST | `/api/categories` | Listar (`?type=`) / crear categoría propia |
| PATCH/DELETE | `/api/categories/:id` | Editar / eliminar categoría propia |
| GET/POST | `/api/transactions` | Listar con filtros (`currency`, por defecto `COP`; `from`, `to`, `kind`, `account_id`, `category_id`, `limit`, `offset`) / crear |
| POST | `/api/transactions/transfer` | Transferir entre dos cuentas de la misma moneda |
| POST | `/api/transactions/exchange` | Comprar o vender dólares entre una cuenta en pesos y una en dólares |
| PATCH/DELETE | `/api/transactions/:id` | Editar / eliminar (las transferencias se eliminan completas) |
| GET/POST | `/api/savings-goals` | Listar con progreso / crear meta |
| PATCH/DELETE | `/api/savings-goals/:id` | Editar / eliminar meta |
| POST | `/api/savings-goals/:id/contributions` | Abonar (monto positivo) o retirar (negativo) |
| GET | `/api/credit-cards` | Tarjetas con deuda, cupo disponible y próximas fechas de corte y pago |
| POST | `/api/credit-cards/:id/payments` | Registrar pago desde una cuenta bancaria o de efectivo |
| POST | `/api/credit-cards/:id/simulate` | Simular meses e intereses para saldar la deuda con una cuota fija |
| GET | `/api/dashboard/summary?month=YYYY-MM` | Resumen del mes en pesos, gastos por categoría y tendencia de 6 meses |
| GET | `/api/usd/summary?month=YYYY-MM` | Saldo en dólares, ingresos y gastos del mes en USD, compras/ventas y precio promedio de compra |
| GET | `/api/admin/metrics` | *(admin)* Métricas globales: usuarios activos, cuentas por tipo, tendencia de 6 meses (nuevos usuarios, movimientos y volumen en pesos) y adopción de funciones |
| GET | `/api/admin/users` | *(admin)* Usuarios con rol, último acceso y cuántas cuentas y movimientos tienen (sin montos) |
| PATCH | `/api/admin/users/:id/role` | *(admin)* Cambiar rol |
| DELETE | `/api/admin/users/:id` | *(admin)* Eliminar usuario |

**Nivel de endeudamiento:** se calcula como deuda total de tarjetas / ingresos del mes. Hasta 30 % se considera saludable, entre 30 % y 50 % moderado, y desde 50 % alto.

## Pantallas

| Ruta | Contenido |
|---|---|
| `/` | Dashboard: KPIs del mes, medidor de endeudamiento, ingresos vs gastos (6 meses), gastos por categoría y últimos movimientos |
| `/movimientos` | Lista agrupada por día con filtros (mes, tipo, cuenta, categoría), crear, editar y eliminar, y categorías propias |
| `/cuentas` | Bancos, efectivo y tarjetas: crear, editar, eliminar y totales |
| `/ahorros` | Metas con progreso, ahorro mensual sugerido, abonos y retiros |
| `/tarjetas` | Deuda, uso del cupo, próximas fechas de corte y pago, pago desde una cuenta y simulador de pago |
| `/dolares` | *(si se activó)* Cuentas en dólares, resumen del mes en USD, comprar o vender dólares, transferir y últimos movimientos |
| `/dolares/movimientos` | *(si se activó)* Movimientos de las cuentas en dólares, con los mismos filtros que Movimientos |
| `/admin` | *(admin)* KPIs, gráficas de crecimiento, movimientos y volumen, adopción de funciones y gestión de usuarios (rol, actividad y eliminación) |
