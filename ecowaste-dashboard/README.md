# EcoWaste Dashboard (Web)

React + TypeScript + Tailwind web dashboard for the EcoWaste Community platform (separate from the mobile app).

## Tech Stack

- React (Vite)
- TypeScript
- Tailwind CSS
- React Router
- Axios
- JWT auth (localStorage)

## Setup

```bash
cd ecowaste-dashboard
npm install
```

Create `.env` (or copy from `.env.example`):

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Run (Dev)

```bash
npm run dev
```

## Build (Prod)

```bash
npm run build
npm run preview
```

## Routes

- `GET /login` (JWT login)
- Admin:
  - `/admin/dashboard`
  - `/admin/users`
  - `/admin/reports`
  - `/admin/pickups`
  - `/admin/assignments`
  - `/admin/content`
  - `/admin/rewards`

## Notes (Roles)

This web app is **admin-only**. Collectors and residents should use the mobile app.
