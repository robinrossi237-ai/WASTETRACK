# EcoWaste Backend

Production-ready Node.js backend API for the EcoWaste project.

## Tech Stack

- Node.js
- Express.js
- TypeScript
- PostgreSQL (`pg`)

## Setup

1. Install dependencies:

```bash
cd ecowaste-backend
npm install
```

2. Configure environment variables:

Create `ecowaste-backend/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/ecowaste_db
JWT_SECRET=supersecretkey
SIGNUP_SECRET=change-me
```

3. Ensure PostgreSQL is running and the database exists:

- Database name: `ecowaste_db`
- Update `DATABASE_URL` with your credentials

## Run (Development)

```bash
npm run dev
```

## Build (Production)

```bash
npm run build
npm start
```

## Health Check

`GET /api/health`

Response:

```json
{
  "status": "OK",
  "service": "EcoWaste Backend",
  "timestamp": "2026-02-06T00:00:00.000Z"
}
```

## Environment Variables

- `PORT` (number): Server port (default: `5000`)
- `DATABASE_URL` (string): PostgreSQL connection string
- `JWT_SECRET` (string): JWT signing secret
- `JWT_EXPIRES_IN` (string, optional): JWT expiry (default: `7d`)
- `BCRYPT_SALT_ROUNDS` (number, optional): Bcrypt cost factor (default: `12`)
- `RATE_LIMIT_WINDOW_MS` (number, optional): Rate limit window in ms (default: `900000`)
- `RATE_LIMIT_MAX` (number, optional): Max requests per window (default: `100`)
- `RATE_LIMIT_AUTHENTICATED_MAX` (number, optional): Max authenticated requests per window (default: `600`)
- `AUTH_RATE_LIMIT_MAX` (number, optional): Max auth requests per window (default: `20`)
- `SIGNUP_SECRET` (string, optional): Required to register an `admin` user via `POST /api/auth/register`
- `CORS_ORIGIN` (string, optional): Comma-separated allowed origins

## Database Migrations (Raw SQL)

- Migration files live in `src/migrations/` and run in filename order (tracked in `schema_migrations`).
- Run migrations:

```bash
npm run migrate
```

## Authentication

- Register: `POST /api/auth/register`
- Login: `POST /api/auth/login`
- Current user: `GET /api/auth/me` (requires `Authorization: Bearer <token>`)

Auth responses include a JWT `token`. Send it as `Authorization: Bearer <token>` for protected endpoints you add.

### Role notes

- `resident` signups are active immediately.
- `collector` signups are created as inactive by default (admin must activate via `PATCH /api/admin/users/:id`).
- `admin` signups require `SIGNUP_SECRET` (send it as `signup_secret` in the register payload).

## Admin API (JWT + admin role required)

- `GET /api/admin/stats`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id`
- `GET /api/admin/collectors`
- `GET /api/admin/reports`
- `PATCH /api/admin/reports/:id`
- `POST /api/admin/reports/:id/assign`
- `GET /api/admin/pickups`
- `PATCH /api/admin/pickups/:id`
- `GET /api/admin/assignments`
- `POST /api/admin/assignments`
- `GET /api/admin/payments`
- `POST /api/admin/payments/:id/approved`
- `POST /api/admin/payments/:id/rejected`
- `GET /api/admin/rewards`
- `POST /api/admin/rewards`
- `GET /api/admin/content`
- `POST /api/admin/content`
- `PATCH /api/admin/content/:id`
- `DELETE /api/admin/content/:id`

## Security Notes

- Rate limiting is enabled in-memory by default (good for single instance; use Redis/shared store for multi-instance).
- Every response includes `X-Request-Id` for log correlation.
