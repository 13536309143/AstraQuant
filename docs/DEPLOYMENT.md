# 部署指南｜Deployment guide

## 1. 环境与范围｜Requirements and scope

- Node.js **24 或更高**，浏览器支持 Canvas / ES modules。 / Node.js **24+**, a browser supporting Canvas and ES modules.
- Windows、macOS、Linux；或 Docker Compose。 / Windows, macOS, Linux, or Docker Compose.
- 网络可访问所选模型及东方财富/腾讯等数据源。纯数据模式不需要模型 key。 / Network access to your model and quote providers. Data-only mode needs no model key.
- 无需下载 M3 权重。云模型在供应商侧推理；选择 Ollama 时需另行安装和下载本地模型。 / M3 weights are not downloaded. Cloud inference runs at the provider; Ollama requires a separate local installation/model download.

## 2. 下载与配置｜Clone and configure

```powershell
git clone https://github.com/13536309143/Stock.git E:\Stock
cd E:\Stock
Copy-Item .env.example .env
notepad .env
```

已有该目录时，在项目目录中操作；不要重复覆盖自己的 `.env`。 / For an existing installation, work in that project directory and preserve your `.env`.

最小配置 / Minimal configuration:

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

其他模型见 [Providers](PROVIDERS.md)。不要把实际 key 写进 README、截图、Git 或浏览器代码。 / See [Providers](PROVIDERS.md) for other models. Keep actual credentials out of README files, screenshots, Git and frontend code.

## 3. 运行｜Run

Windows 双击 `启动股研助手.cmd`，或： / Double-click the Windows launcher, or run:

```powershell
npm.cmd start
# 另一个终端 / In another terminal:
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

打开 **http://127.0.0.1:8787**。`npm start` 在前台运行，Ctrl+C 停止。Windows 后台启动用 `停止股研助手.cmd` 停止。无需先运行 npm install；需要测试开发时再运行 `npm ci`。

Open **http://127.0.0.1:8787**. `npm start` runs in the foreground; Ctrl+C stops it. Use the Windows stop launcher for its background process. `npm install` is unnecessary for runtime; use `npm ci` for development tests.

修改 `.env` 后重启。Windows 启动器读取配置端口；停止器根据本项目 PID 和进程路径确认目标。 / Restart after editing `.env`. The Windows launcher reads the configured port; the stop script verifies the saved PID and project process path.

## 4. 首次验证｜First-run checks

1. 在“系统与数据”查看配置，点击“测试模型连接”；会调用一次收费模型请求。 / Inspect settings and test the model connection; this makes one potentially billable request.
2. “指数/个股行情”输入 `600519`、`00700.HK`、`AAPL`，检查日/周/月和分时图。 / Check daily/weekly/monthly and intraday charts for the example symbols.
3. “大盘星图”分别同步 A/港/美股票池。分页同步需要时间，完整性及抓取时间会显示。 / Sync each market in the constellation. Pagination takes time; completeness and timestamps are displayed.
4. 先选择“数据与指标”验证财报及来源，再运行完整协作。 / Verify statements/sources in data-only mode before starting full research.
5. 完整研究通常为 8 次文本调用，另可能有 3 次 MiniMax 搜索；重试、追问及不同模型的推理 token 可能增加费用。 / Full research normally uses eight text calls and optionally three MiniMax searches. Retries, follow-ups and reasoning tokens can add cost.

## 5. Docker Compose

先填写 `.env`，再运行： / Configure `.env` first:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 -f
docker compose stop
docker compose start
docker compose down
```

浏览器入口保持 **http://127.0.0.1:8787**。容器内部绑定 `0.0.0.0`，宿主机仅发布到 `127.0.0.1`。数据卷为 `astraquant-data`（Compose 实际名称通常带项目名前缀）。`down` 不删除该卷；不要使用 `down -v`，除非确实要删除数据。

The browser URL stays **http://127.0.0.1:8787**. The container binds internally to `0.0.0.0`, while the host publishes loopback only. The named data volume is `astraquant-data` (usually prefixed by the Compose project name). `down` preserves it; `down -v` deletes persistent data.

镜像不会包含 `.env`、报告或本地缓存；凭据运行时由 env_file 注入。容器以非 root 用户运行。 / The image excludes credentials, reports and caches. Credentials enter at runtime through env_file. The container runs as a non-root user.

本次实际验证以 Windows Node 24 为主；Docker 文件已静态检查，若本机没有 Docker 就不能声称完成镜像实测。 / This release was exercised primarily on Windows Node 24. Docker files are provided; image execution must be verified on a Docker-enabled host.

## 6. 远程服务器｜Remote server

本应用没有多用户认证。远程 Linux 服务器保持默认 `HOST=127.0.0.1`，从自己的电脑建立隧道： / The application has no multi-user authentication. Keep the remote server bound to loopback, then connect from your computer:

```bash
ssh -L 8787:127.0.0.1:8787 your-user@your-server
```

在本机浏览器访问原地址。无需打开公网 8787 端口。Host/Origin 校验仍使用 localhost/127.0.0.1。公开域名、多用户登录及反向代理认证不属于当前实现。 / Open the usual localhost URL on your computer. Do not publish port 8787 to the internet. Host/Origin validation still expects localhost/127.0.0.1. Public-domain hosting and multi-user/reverse-proxy authentication are not implemented.

## 7. 持久化、更新和备份｜Persistence, upgrades and backups

`data/stock.db` 保存任务、自选和持仓；`data/cache`、`data/search`、`data/panorama` 保存缓存；`data/agent-errors` 可能含模型原始输出。`.env` 是私有配置，`logs/` 是运行日志。 / SQLite stores jobs, watchlists and holdings. Cache directories hold source snapshots. Agent error files may contain raw model output. `.env` is private configuration; `logs/` contains runtime logs.

备份时先停止服务，再复制 `.env` 和整个 `data/` 到私人位置，避免漏掉 SQLite WAL 中未合并的数据。不要把私人备份提交 GitHub。 / Stop the service before copying `.env` and the entire `data/` to a private backup location, avoiding an inconsistent SQLite/WAL copy. Do not commit backups.

更新流程 / Upgrade:

```bash
# Stop service and make a private backup first
git pull --ff-only
npm ci --ignore-scripts  # Required for development/test dependencies only
npm test
npm start
# Docker alternative:
docker compose up -d --build
```

## 8. 排错｜Troubleshooting

| 现象 Symptom | 处理 Action |
| --- | --- |
| Node/SQLite 相关错误 / Node or SQLite error | 确认 node --version ≥24；不要使用旧版 Node / Verify Node ≥24 |
| 端口占用 / Port occupied | 先检查本项目是否已运行；调整 PORT 后重启 / Check existing service, or change PORT and restart |
| 401 / 403 模型错误 | 检查所选供应商的 key、地区、额度和模型权限 / Verify provider key, region, quota and model access |
| 404 模型错误 | BASE_URL 应为文档中的根路径，不能重复 chat/completions；Azure 模型是部署名称 / Check base path; Azure model means deployment name |
| 输出截断 / Truncated output | 选择输出限制和上下文足够的模型；截断结果不会作为有效报告 / Use a model with adequate limits; incomplete output is rejected |
| 行情/板块缺失 / Missing quotes/sectors | 查看来源、时间与错误；公开接口可能暂时中断；降级数据有单独标记 / Inspect provenance/errors; fallback data is labeled |
| 港美资金流不可用 / Overseas flow missing | 当前没有可核验的同口径来源，并非用零替代 / No verified comparable provider is connected; missing is not zero |
| 搜索不可用 / Search unavailable | MiniMax 搜索需单独 key 和相应权限；其他模型仍可分析已采集证据 / MiniMax search needs its own credential/access |
| Windows npm.ps1 被拦截 | 使用 npm.cmd；启动器不需要全局修改执行策略 / Use npm.cmd; launchers do not change global policy |

## 9. 开发检查｜Development checks

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run release:check
```

离线测试不调用收费模型；`scripts/smoke-*.mjs` 是需要本地服务/真实数据的手动集成检查。实验复现见 [EXPERIMENTS](EXPERIMENTS.md)。 / Offline tests make no paid model calls. Smoke scripts are manual integration checks requiring the local service/live data. See [EXPERIMENTS](EXPERIMENTS.md) for research reproduction.
