# Local HTTP API

**English** | [简体中文](API.zh-CN.md)

[Documentation](README.md) · [Project home](../README.md)

Default base: `http://127.0.0.1:8787`. Responses are JSON except Markdown export. There is no user authentication; use loopback or a private SSH tunnel.

POST requests require `Content-Type: application/json` and `X-Stock-Client: local`. Browser Origin/Host must match loopback and the configured port. Expensive operations are rate-limited per process.

| Method | Path | Parameters and purpose |
| --- | --- | --- |
| GET | /api/health | health and nonsecret global config |
| GET | /api/search?q= | symbol search |
| GET | /api/market/bars | symbol, period, adjust |
| GET | /api/market/quote | symbol |
| GET | /api/market/flow | symbol; comparable A-share flows |
| GET | /api/panorama/snapshot | market=CN/HK/US |
| GET | /api/panorama/status | market=CN/HK/US |
| POST | /api/panorama/sync | {market}; async sync |
| GET | /api/panorama/indices | 15 cross-market indices |
| GET | /api/panorama/boards | type=industry/concept |
| GET | /api/jobs | job list |
| POST | /api/jobs | {symbol, mode:deep/data, style, notes} |
| GET | /api/jobs/:id | evidence, roles, report, usage |
| POST | /api/jobs/:id/cancel | cancellation |
| GET | /api/jobs/:id/export | format=md/json |
| POST | /api/jobs/:id/chat | {question}; billable follow-up |
| GET/POST | /api/workspace | local watchlist and portfolio |
| POST | /api/model/test | live global-model test |
| POST | /api/screen | {symbols:[...]}; up to 12 symbols |
| POST | /api/valuation | {fcff,netDebt,shares,growth,discount,terminal,years} |
| POST | /api/backtest | {symbol,fast,slow,feeBps} |
| POST | /api/portfolio/value | value saved holdings |

`period` values: `intraday five 1 5 15 30 60 101 102 103`, mapping to intraday, five-day, minute, daily, weekly and monthly bars. `adjust`: `0` unadjusted, `1` forward-adjusted, `2` backward-adjusted. Benchmarks use unadjusted prices.

Stock examples: `600519`, `00700.HK`, `US:AAPL`. Indices use `IDX:CSI300`, `IDX:HSI`, `IDX:SPX`; boards use `BOARD:BKxxxx`. Indices and boards use distinct namespaces and are rejected by company research.

```bash
curl 'http://127.0.0.1:8787/api/market/bars?symbol=AAPL&period=101&adjust=1'
curl -X POST http://127.0.0.1:8787/api/jobs \
  -H 'Content-Type: application/json' -H 'X-Stock-Client: local' \
  -d '{"symbol":"600519","mode":"data"}'
```

Response schemas follow server/module implementations and frontend usage; this is not a versioned public third-party service.
