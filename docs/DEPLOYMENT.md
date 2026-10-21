# Deployment & Operations Guide

This guide covers deployment options for the **Jewellery Catalog Audit Dashboard** across local development, VPS/Docker containers, and serverless hosting environments.

---

## 1. Local Development Architecture

The project runs using a dual-process setup managed via `npm run start:all`:
- **Express Backend:** Runs on `http://localhost:3000` (`server/index.js`).
- **Vite Client:** Runs on `http://localhost:5173` with reverse-proxy routing for `/api/*` to port 3000.

### Starting Local Environment:
```bash
# 1. Install dependencies
npm install

# 2. Run both backend and frontend concurrently
npm run start:all
```

Alternatively, run them in separate terminals:
```bash
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend
npm run dev
```

---

## 2. Production Node.js Server Deployment

In a standard Node.js server (Ubuntu/Debian VPS, AWS EC2, DigitalOcean Droplet):

```bash
# 1. Clone repository
git clone <repository_url>
cd jewellery-catalog-audit-dashboard

# 2. Install production dependencies
npm ci

# 3. Build the frontend client bundle
npm run build

# 4. Copy .env.example to .env.local and configure Google Sheets & Staging
cp .env.example .env.local

# 5. Place google-service-account.json into ./secrets/
# (or set GOOGLE_SERVICE_ACCOUNT_BASE64 in .env.local)

# 6. Run the production server using PM2 or systemd:
npm run server
```

The Express server can serve the static frontend bundle from `./dist` if configured, or you can point Nginx to serve `./dist` and reverse proxy `/api/*` to `http://127.0.0.1:3000`.

---

## 3. Serverless Deployments (Vercel / Netlify / Render)

### Critical Serverless Considerations:
- **Ephemeral Filesystems:** Serverless functions cannot persist local files (like SQLite `.db` or `data/report.csv`) between invocations.
- **Google Sheets As Database:** Because Google Sheets is cloud-hosted, it is 100% compatible with serverless execution.
- **Service Account Credentials:** Use `GOOGLE_SERVICE_ACCOUNT_BASE64` in the Vercel/Netlify environment variable settings rather than relying on local `./secrets/*.json` paths.
- **Timeout Limits:** Magento staging downloads (`/api/sync`) of very large catalog exports (100MB+) may exceed typical 10-second serverless execution limits. If running in a serverless environment, use a background worker or long-running container service (like Railway, Render Web Service, or Fly.io) for heavy sync operations.

---

## 4. Rollback Strategy

1. **Backup Snapshots:** The server automatically writes point-in-time CSV snapshots to `data/backups/report-YYYY-MM-DDTHH-mm-ss.csv` before overwriting the active report.
2. **Reverting Changes:** If an audit delta causes incorrect updates, retrieve the previous snapshot from `data/backups/` and restore it.
3. **Google Sheets Version History:** Google Sheets maintains an immutable revision history. In your Google Spreadsheet, navigate to **File > Version history > See version history** to restore any worksheet to a previous timestamp if needed.
