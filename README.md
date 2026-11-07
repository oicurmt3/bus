# Ride Rate

Public web app for rating Transperth bus rides in Perth. Live on Cursor Apps at [ride-rate.apps.grok.bot](https://ride-rate.apps.grok.bot).

## Stack

- Static pages in `public/` (built from root HTML/JS).
- Serverless API: `api/log_rating.js`, `api/ratings.js`.
- Postgres in production (`cursor-app.json`); in-memory PGlite locally.

## Local development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:8765`.

## Build (publish)

```bash
npm run build
```

Runs SQL migrations when `DATABASE_URL` is set, then copies static assets and `js/` into `public/`.

## cPanel (sandgroper.net)

Use the hardened PHP files under `cpanel/` (not shipped to Cursor hosting).
