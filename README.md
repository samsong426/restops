# RestOps

Local restaurant operations tool for small, single-location restaurants. Covers scheduling, inventory, dish sales, and end-of-day close — no cloud account required.

## Features

- **Schedule** — weekly shift grid, time clock with actual hours vs. scheduled, labor cost and % of revenue
- **Inventory** — par-level tracking, batch/expiry tracking, FIFO consumption estimates from dish sales, waste risk alerts, order sheet
- **Recipes** — link ingredients to dishes, food cost % per dish
- **Sales** — log daily dish sales (additive), CSV import, 14-day revenue chart, 7-day forecast, per-entry edit/delete
- **EOD Close** — step-by-step checklist, pre-fills covers and sales from dish sales, history with delete

## Running in development

Requires Node.js 18+.

```bash
npm install
npm start
# → http://localhost:3001
```

## Building the macOS app

Produces `dist/RestOps.app` — a self-contained double-click app with its own Node.js runtime. No install required on the target machine.

```bash
bash build-mac.sh
```

Output:
- `dist/RestOps.app` — drag to Applications or share directly
- `dist/RestOps.zip` — zip of the above for easy sharing

Double-clicking the app starts the server and opens `http://localhost:3001` in the default browser automatically.

> **Note:** The database (`data.db`) lives inside `RestOps.app/Contents/Resources/`. Back it up before replacing the app with a new build.

## Data

All data is stored locally in a SQLite database (`data.db`). Nothing is sent to any server.

## Stack

- **Backend** — Node.js, Express 5, better-sqlite3
- **Frontend** — Vanilla JS, no build step
