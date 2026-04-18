# RestOps

Local restaurant operations tool for small, single-location restaurants. Covers scheduling, inventory, dish sales, cash flow, and end-of-day close — no cloud account required.

## Features

- **Schedule** — weekly shift grid, time clock with actual hours vs. scheduled, labor cost and % of revenue
- **Inventory** — par-level tracking, batch/expiry tracking with purchase dates, FIFO consumption estimates from dish sales, waste risk alerts (expiry-adjusted), order sheet, duplicate item protection
- **Recipes** — link ingredients to dishes, food cost % per dish
- **Sales** — log daily dish sales (additive), CSV import, 14-day revenue chart, 7-day forecast, per-entry edit/delete
- **Cash Flow** — daily view combining revenue (live from dish sales), labor cost (from schedule), inventory purchased, and other expenses; add/delete ad-hoc expense entries
- **EOD Close** — 6-step checklist pre-filled from dish sales; includes daily expenses review with link to Cash Flow; CSV export for any date range (weekly/monthly presets)

## Running in development

Requires Node.js 18+.

```bash
npm install
npm start
# → http://localhost:3001
```

## Desktop app packaging

The project can be packaged as a real macOS desktop app with Electron. It opens in its own window, not in the browser.

```bash
npm install
npm run build:mac
```

Output:
- `dist/*.zip` — signed/unsigned macOS app archive output from Electron Builder

When the desktop app launches, it starts the local server internally and opens the UI in an app window.

> **Note:** RestOps resolves the database in one place. It prefers your existing `~/Downloads/code/restaurant-ops/data.db`, then falls back to the repo-local `data.db`, and only uses the app-data folder if neither exists.

## Data

All data is stored locally in a SQLite database (`data.db`). Nothing is sent to any server.

## Stack

- **Backend** — Node.js, Express 5, better-sqlite3
- **Frontend** — Vanilla JS, no build step
