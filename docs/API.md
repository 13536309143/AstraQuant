# 本地 HTTP API｜Local HTTP API

默认根地址 / Default base: `http://127.0.0.1:8787`。所有数据返回 JSON；导出另支持 Markdown。无用户认证，仅适合本机或私人 SSH 隧道。 / Responses are JSON except Markdown export. There is no user authentication; use loopback or a private SSH tunnel.

写请求要求 `Content-Type: application/json` 与 `X-Stock-Client: local`。浏览器 Origin 与 Host 必须匹配 localhost/127.0.0.1 及配置端口。高成本操作有进程级限流。 / POST requests require these headers. Browser Origin/Host must match loopback and the configured port. Expensive operations are rate-limited per process.

| Method | Path | 参数 / Purpose |
| --- | --- | --- |
| GET | /api/health | 运行、全局模型配置（不含 key）/ health and nonsecret global config |
| GET | /api/search?q= | 名称/代码建议 / symbol search |
| GET | /api/market/bars | symbol, period, adjust |
| GET | /api/market/quote | symbol |
| GET | /api/market/flow | symbol；A 股同口径资金 / A-share flow |
| GET | /api/panorama/snapshot | market=CN/HK/US |
| GET | /api/panorama/status | market=CN/HK/US |
| POST | /api/panorama/sync | {market}；异步同步 / async sync |
| GET | /api/panorama/indices | 15 个指数 / cross-market indices |
| GET | /api/panorama/boards | type=industry/concept |
| GET | /api/jobs | 任务摘要 / job list |
| POST | /api/jobs | {symbol, mode:deep/data, style, notes} |
| GET | /api/jobs/:id | 证据、角色、报告与使用量 / evidence, roles, report, usage |
| POST | /api/jobs/:id/cancel | 取消未完成任务 / cancellation |
| GET | /api/jobs/:id/export | format=md/json |
| POST | /api/jobs/:id/chat | {question}；收费追问 / billable follow-up |
| GET/POST | /api/workspace | 本地自选/持仓 / local watchlist and portfolio |
| POST | /api/model/test | 实测全局模型；可能收费 / live global-model test |
| POST | /api/screen | {symbols:[...]}，最多 12 个 / up to 12 |
| POST | /api/valuation | {fcff,netDebt,shares,growth,discount,terminal,years} |
| POST | /api/backtest | {symbol,fast,slow,feeBps} |
| POST | /api/portfolio/value | 从本地持仓计算 / value saved holdings |

行情 period：`intraday five 1 5 15 30 60 101 102 103`；adjust：`0` 不复权、`1` 前复权、`2` 后复权。指数/板块固定不复权。 / Periods map to intraday, five-day, minute, daily, weekly and monthly bars. Benchmarks use unadjusted prices.

股票示例：`600519`、`00700.HK`、`US:AAPL`。指数使用独立代码，如 `IDX:CSI300`、`IDX:HSI`、`IDX:SPX`，板块如 `BOARD:BKxxxx`。指数可看行情，不应送入公司财务分析。 / Indices and boards use distinct namespaces and are rejected by company research.

```bash
curl 'http://127.0.0.1:8787/api/market/bars?symbol=AAPL&period=101&adjust=1'
curl -X POST http://127.0.0.1:8787/api/jobs \
  -H 'Content-Type: application/json' -H 'X-Stock-Client: local' \
  -d '{"symbol":"600519","mode":"data"}'
```

字段结构以 `server.mjs`、对应 `lib/` 模块和前端请求为准；本项目未提供稳定的第三方公共 API 版本承诺。 / Response schemas follow server/module implementations and frontend usage; this is not a versioned public third-party service.
