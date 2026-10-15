# Deployment guide

**English** | [简体中文](DEPLOYMENT.zh-CN.md)

[Documentation](README.md) · [Project home](../README.md)

## Requirements and scope

- Node.js **24+**, a browser supporting Canvas and ES modules.
- Windows, macOS, Linux, or Docker Compose.
- Network access to your model and quote providers. Data-only mode needs no model key.
- M3 weights are not downloaded. Cloud inference runs at the provider; Ollama requires a separate local installation/model download.

## Clone and configure

```powershell
git clone https://github.com/13536309143/AstraQuant.git E:\Stock
cd E:\Stock
Copy-Item .env.example .env
notepad .env
```

For an existing installation, work in that project directory and preserve your `.env`.

Minimal configuration:

```dotenv
LLM_PROVIDER=minimax
MINIMAX_API_KEY=your_key_here
MINIMAX_MODEL=MiniMax-M3
MINIMAX_BASE_URL=https://api.minimax.cn/v1
MINIMAX_WEB_SEARCH=true
AGENT_CONCURRENCY=2
PORT=8787
LLM_TIMEOUT_MS=180000
```

See [Providers](PROVIDERS.md) for other models. Keep actual credentials out of README files, screenshots, Git and frontend code.

## Run

Use the bundled Windows launcher, or run:

```powershell
npm.cmd start
# In another terminal:
Invoke-RestMethod http://127.0.0.1:8787/api/health
```

macOS / Linux:

```bash
cp .env.example .env   # First installation only; edit it before starting
npm start
# Equivalent:
sh scripts/start.sh
curl http://127.0.0.1:8787/api/health
```

Open **http://127.0.0.1:8787**. `npm start` runs in the foreground; Ctrl+C stops it. Use the Windows stop launcher for its background process. `npm install` is unnecessary for runtime; use `npm ci` for development tests.

For the Windows background launcher, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1`; stop it with the same command targeting `scripts/stop.ps1`.

Restart after editing `.env`. The Windows launcher reads the configured port; the stop script verifies the saved PID and project process path.

## First-run checks

1. Inspect settings and test the model connection; this makes one potentially billable request.
2. Check daily/weekly/monthly and intraday charts for `600519`, `00700.HK` and `AAPL`.
3. Sync each market in the constellation. Pagination takes time; completeness and timestamps are displayed.
4. Verify statements/sources in data-only mode before starting full research.
5. Full research normally uses eight text calls and optionally three MiniMax searches. Retries, follow-ups and reasoning tokens can add cost.

## Docker Compose

Configure `.env` first:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 -f
docker compose stop
docker compose start
docker compose down
```

The browser URL stays **http://127.0.0.1:8787**. The container binds internally to `0.0.0.0`, while the host publishes loopback only. The named data volume is `astraquant-data` (usually prefixed by the Compose project name). `down` preserves it; `down -v` deletes persistent data.

The image excludes credentials, reports and caches. Credentials enter at runtime through env_file. The container runs as a non-root user.

This release was exercised primarily on Windows Node 24. Docker files are provided; image execution must be verified on a Docker-enabled host.

## Remote server

The application has no multi-user authentication. Keep the remote server bound to loopback, then connect from your computer:

```bash
ssh -L 8787:127.0.0.1:8787 your-user@your-server
```

Open the usual localhost URL on your computer. Do not publish port 8787 to the internet. Host/Origin validation still expects localhost/127.0.0.1. Public-domain hosting and multi-user/reverse-proxy authentication are not implemented.

## Persistence, upgrades and backups

`data/stock.db` stores jobs, watchlists and holdings. `data/cache`, `data/search` and `data/panorama` hold source snapshots; `data/agent-errors` may contain raw failed responses. `.env` is private configuration; `logs/` contains runtime logs.

Stop the service before copying `.env` and the entire `data/` to a private backup location, avoiding an inconsistent SQLite/WAL copy. Do not commit backups.

Upgrade:

```bash
# Stop service and make a private backup first
git pull --ff-only
npm ci --ignore-scripts  # Required for development/test dependencies only
npm test
npm start
# Docker alternative:
docker compose up -d --build
```

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Node or SQLite error | Verify Node ≥24 |
| Port occupied | Check existing service, or change PORT and restart |
| Model HTTP 401/403 | Verify provider key, region, quota and model access |
| Model HTTP 404 | Check base path; Azure model means deployment name |
| Truncated output | Use a model with adequate limits; incomplete output is rejected |
| Missing quotes/sectors | Inspect provenance/errors; fallback data is labeled |
| Overseas flow missing | No verified comparable provider is connected; missing is not zero |
| Search unavailable | MiniMax search needs its own credential/access |
| Windows npm.ps1 blocked | Use npm.cmd; launchers do not change global policy |

## Development checks

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run release:check
```

Offline tests make no paid model calls. Smoke scripts are manual integration checks requiring the local service/live data. See [EXPERIMENTS](EXPERIMENTS.md) for research reproduction.
