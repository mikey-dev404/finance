# Windows Docker host (S:/docker/finance)

**Copy-ready package:** run `npm run prepare:windows`, then copy the whole [`windows-host/`](../windows-host/) folder to `S:\docker\finance`. Follow [`windows-host/INSTALL.txt`](../windows-host/INSTALL.txt).

## Layout on Windows

| Path | Purpose |
|------|---------|
| `S:/docker/finance` | Contents of `windows-host/` |
| `S:/docker/finance/data/finance.sqlite` | SQLite source of truth (bind-mounted to `/data`) |

Tailscale stays on the **Windows host** (not inside Docker). Publish port **18765**.

## No-data-loss migration

See `windows-host/INSTALL.txt`. Summary:

1. Backup Mac `~/Library/Application Support/Finance` first.
2. Quit Finance on Mac.
3. **Copy** (not move) `finance.sqlite` (+ `-wal`/`-shm` if present) into `S:/docker/finance/data/`.
4. `docker compose up -d --build` from that folder.
5. Verify in Safari before re-pairing phones. Keep the Mac backup.

The container opens an existing `finance.sqlite` only. It never deletes that file.

## Local headless (Mac, without Docker)

Uses Electron’s Node ABI so `better-sqlite3` matches the desktop install. The Docker image rebuilds the native module for plain Node.

```bash
npm run phone:build
mkdir -p data
# optional: copy a sqlite into ./data first
FINANCE_DATA_DIR=./data FINANCE_WEB_DIR=./mobile/www npm run server
```
