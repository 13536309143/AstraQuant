# Features and implementation

**English** | [简体中文](FEATURES.zh-CN.md)

[Documentation](README.md) · [Project home](../README.md)

## Research

The research workspace accepts stock codes or names for mainland China, Hong Kong and US markets. Six styles are available: balanced, dividends, value, growth, trend and contrarian. Preferences change emphasis while preserving evidence and source requirements.

The workflow starts with fundamentals, industry, macro, technical, valuation and risk specialists, followed by a skeptic and a synthesis committee. Roles share a model by default; per-role model routing is also supported. Data-only mode makes no LLM calls. Jobs support cancellation, history, follow-up on the original evidence, Markdown/JSON export and browser printing.

Financial evidence includes statements, annual history, ownership, pledges, dividends and disclosure leads, with different coverage by market. TTM calculations bridge fiscal periods and align statement dates. Missing fields remain unknown. Banks, insurers and brokers are subject to industry applicability limits. Retrieved statements may contain later restatements and are not a historical point-in-time database.

Source-ID validation rejects nonexistent references but cannot establish whether each claim correctly interprets a source. Insufficient coverage, missing financial data or stale quotes constrain the final conclusion.

## Market terminal

Periods include intraday, five-day, 1/5/15/30/60-minute, daily, weekly and monthly bars. Unadjusted, forward-adjusted and backward-adjusted prices are available where supported; indices remain unadjusted. Historical depth depends on the vendor.

Main-chart indicators include MA5/10/20/50 and BOLL. Lower panels include MACD(12,26,9), RSI14 and KDJ(9,3,3). Volume and traded value have separate panels. Crosshairs, dragging, zooming, keyboard navigation, fullscreen, CSV export and optional 60-second refresh are supported.

A-shares support five-level order-book snapshots and vendor-classified large/super-large order flows. Buy value, sell value, net value and intraday/daily series are distinguished. The order-book snapshot is not tick-by-tick Level-2. “Main-force” flow does not identify verified institutions. Comparable overseas flows remain unavailable when no verified source is connected.

## Market constellation and data center

Market lists are paginated into local snapshots, displaying returned totals, deduplicated counts, sync status and sources. Lists may include funds, notes, delisted listings or multiple currency counters; listing counts must not be described as unique companies.

Constellations support industry clusters, heatmaps and return scatterplots. Nodes scale by turnover or market capitalization. Search, industry filters, display limits, wheel zoom, dragging and navigation to stock charts/research are available. Positions are visual layouts, not causal relationships or forecasts.

The data center provides market, index, industry, theme, capital-flow, valuation, security and source views. It includes 15 cross-market indices, comparisons normalized on common trading dates, security filters and CSV export. PE medians use positive observations only. Traded values stay separated by currency rather than relying on unverified FX rates.

If A-share industry/theme quotes fail, company memberships can produce a clearly labeled equal-weight fallback. It is not an official sector index level. Theme memberships overlap and should not be summed without deduplication.

## Portfolios, valuation and backtesting

Watchlist screening handles up to 12 securities per batch. Transparent scores represent research priority, not the probability of appreciation. Holdings accept quantities/costs and show values, profit/loss and concentration by currency. Quantities/costs are not sent to the model.

DCF uses FCFF/WACC assumptions, subtracts net debt and calculates per-share value, terminal-value weight and sensitivities. Users must verify inputs; subjective assumptions do not become observed facts.

The application's moving-average backtest delays execution and includes costs and a buy-and-hold baseline. Separate experiments test fixed price rules, signal ablations, next-open execution and expanding-window learned forecasts. They do not validate historical returns of the complete eight-role LLM system.

## Storage and access

SQLite, reports, caches and failed model outputs are under `data/`; runtime logs are under `logs/`. These directories and `.env` are excluded from GitHub. Security evidence, preferences, supplied notes and follow-up questions are sent to the selected model provider.

The default binding is `127.0.0.1`, and there is no multi-user authentication. See [deployment](DEPLOYMENT.md) for installation, backups and private SSH access.
