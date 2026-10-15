# Release notes / 发布记录

## 1.0.0 — AstraQuant · 星衡智研

- A/HK/US research workstation with six specialists, skeptic and synthesis committee.
- Six research styles, evidence/source tracking, report history, follow-up and exports.
- Market constellation, panoramic data center, index and security views.
- Interactive multi-period charts, technical indicators and verified A-share flow fields.
- Sixteen provider configurations, native OpenAI/Claude/Gemini protocols and per-role routing.
- Five research experiment groups with six measured chart panels, including expanding-window learned forecasts, and public aggregate results.
- Chinese/English README, deployment and provider documentation; Docker and CI definitions.

Validation / 验证：28 个离线测试通过；MiniMax-M3 真实连接及 27 次受控案例调用成功；真实三市场行情、资金恒等式、API、来源保护和跨站请求拒绝通过。其他供应商仅协议模拟验证。Docker CLI 存在但守护进程未运行，镜像尚未实测。

28 offline tests passed. Live MiniMax connection and 27 controlled-case calls succeeded. Live three-market chart/flow/API checks passed. Other providers have mock protocol coverage. Docker image execution remains unverified because the local daemon was unavailable.
