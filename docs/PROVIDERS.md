# 模型供应商｜Model providers

统一调用接口为 `callProvider(messages, { role, maxTokens, signal })`。供应商分别构造请求、校验端点和解析 usage；不会把一家供应商的 key 自动发送给另一家。 / `callProvider` normalizes invocation while keeping request formats and credentials separate.

## 配置规则｜Configuration

设置 `LLM_PROVIDER`，再设置对应前缀的 `*_API_KEY` 和 `*_MODEL`。优先使用账号中实际启用的模型 ID，不假定任何账号都能访问某个“最新模型”。`*_BASE_URL` 可覆盖默认官方地址。修改后重启。 / Select a provider and configure its key/model. Use an enabled model ID from your account rather than assuming access to a particular latest model. Restart after editing.

| LLM_PROVIDER | 环境前缀 Env prefix | 协议 Protocol | 默认 Base URL |
| --- | --- | --- | --- |
| minimax | MINIMAX | Chat + MiniMax fields | https://api.minimax.cn/v1 |
| openai | OPENAI | Responses | https://api.openai.com/v1 |
| anthropic | ANTHROPIC | Messages | https://api.anthropic.com/v1 |
| gemini | GEMINI | generateContent | https://generativelanguage.googleapis.com/v1beta |
| deepseek | DEEPSEEK | Chat | https://api.deepseek.com/v1 |
| qwen | QWEN | Chat | https://dashscope.aliyuncs.com/compatible-mode/v1 |
| moonshot | MOONSHOT | Chat | https://api.moonshot.cn/v1 |
| zhipu | ZHIPU | Chat | https://open.bigmodel.cn/api/paas/v4 |
| siliconflow | SILICONFLOW | Chat | https://api.siliconflow.cn/v1 |
| openrouter | OPENROUTER | Chat | https://openrouter.ai/api/v1 |
| groq | GROQ | Chat | https://api.groq.com/openai/v1 |
| xai | XAI | Chat | https://api.x.ai/v1 |
| ark | ARK | Chat | https://ark.cn-beijing.volces.com/api/v3 |
| azure | AZURE | Azure Chat v1 | 自行设置资源根地址 / Configure resource root |
| ollama | OLLAMA | Local Chat-compatible | http://127.0.0.1:11434/v1 |
| custom | CUSTOM | Chat-compatible | 自行设置可信网关 / Configure trusted gateway |

默认模型只对兼容原项目的 MiniMax、DeepSeek、Qwen 提供别名；其他供应商必须显式填写模型。别名可能由供应商调整，实际可用性以控制台为准。 / Only MiniMax, DeepSeek and Qwen have convenience defaults. Other providers require explicit models. Provider aliases and access may change.

## 示例｜Examples

以下是**互斥的全局配置示例**，选择一组填写 `.env`。 / Choose one global configuration below.

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=your_enabled_model_id
# Optional; only for models supporting it
# OPENAI_REASONING_EFFORT=low
```

OpenAI 走 Responses，发送 `store:false`，使用 `max_output_tokens`，不默认发送可能不受支持的 temperature。正文只提取 output_text。 / OpenAI uses Responses with `store:false` and `max_output_tokens`, omitting optional sampling settings by default. Only text output is extracted. See [official text generation documentation](https://developers.openai.com/api/docs/guides/text).

```dotenv
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_key
ANTHROPIC_MODEL=your_enabled_claude_model
```

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_google_key
GEMINI_MODEL=your_enabled_gemini_model
```

Claude 使用独立 system 字段、Messages API 和版本头；Gemini 使用 systemInstruction、contents 和 x-goog-api-key。思考块不进入报告。 / Claude uses its native Messages schema; Gemini uses generateContent fields and its own authentication header. Thought blocks are excluded. See [Claude Messages](https://platform.claude.com/docs/en/api/messages/create) and [Gemini generateContent](https://ai.google.dev/api/generate-content).

```dotenv
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_MODEL=deepseek-chat
```

```dotenv
LLM_PROVIDER=qwen
QWEN_API_KEY=your_regional_key
QWEN_MODEL=qwen-plus
# New workspace-specific endpoints are also accepted:
# QWEN_BASE_URL=https://your-workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
```

千问 key 和 endpoint 必须匹配地域；默认关闭 thinking 以保障正文长度预算。 / Qwen key and endpoint regions must match. Thinking is disabled in the adapter to reserve the output budget for report text. See [DeepSeek](https://api-docs.deepseek.com/) and [Qwen compatibility](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope).

```dotenv
LLM_PROVIDER=azure
AZURE_API_KEY=your_azure_key
AZURE_BASE_URL=https://your-resource.openai.azure.com
AZURE_MODEL=your_deployment_name
# Optional legacy deployment API; otherwise uses /openai/v1/chat/completions
# AZURE_API_VERSION=2024-10-21
```

Azure 的 model 填部署名称，BASE_URL 仅填资源根地址。 / Azure model means deployment name; use the resource root as base URL. See [Azure Chat REST](https://learn.microsoft.com/en-us/azure/foundry/openai/latest).

```dotenv
LLM_PROVIDER=ollama
OLLAMA_MODEL=your_installed_model_tag
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
MINIMAX_WEB_SEARCH=false
```

先在 Ollama 安装并运行足够上下文长度的模型；本项目不自动下载模型。跨容器访问本机 Ollama 时可配置 `http://host.docker.internal:11434/v1` 并显式设置 `LLM_ALLOW_LOCAL_NETWORK=true`；Linux 还需自行处理 host-gateway 映射。 / Install and serve a suitable model in Ollama first. For Docker-to-host access, configure the host endpoint and explicitly enable local-network access; Linux may need host-gateway mapping. See [Ollama compatibility](https://docs.ollama.com/api/openai-compatibility).

```dotenv
LLM_PROVIDER=custom
CUSTOM_BASE_URL=https://your-trusted-gateway.example/v1
CUSTOM_API_KEY=your_gateway_key
CUSTOM_MODEL=your_gateway_model
# Some gateways require this instead of max_tokens:
# CUSTOM_TOKEN_PARAMETER=max_completion_tokens
```

自定义网关仅支持 Chat Completions 协议。vLLM 等本地推理可通过 `ollama` 的本地 Chat 适配方式接入；云网关使用独立 CUSTOM key。 / Custom gateways use Chat Completions. Local vLLM-compatible servers may use the local `ollama` adapter; cloud gateways use a separate CUSTOM credential.

## 按角色路由｜Per-role routing

```dotenv
LLM_PROVIDER=minimax
MINIMAX_API_KEY=your_minimax_key
MINIMAX_MODEL=MiniMax-M3

AGENT_RISK_PROVIDER=openai
AGENT_RISK_MODEL=your_enabled_openai_model
OPENAI_API_KEY=your_openai_key

AGENT_SKEPTIC_PROVIDER=anthropic
AGENT_SKEPTIC_MODEL=your_enabled_claude_model
ANTHROPIC_API_KEY=your_anthropic_key
```

可用角色 ID：`fundamental industry macro technical valuation risk skeptic committee`。优先级：角色模型 → 供应商模型 → LLM_MODEL → 供应商默认值。 / Available role IDs are listed above. Model precedence: role override, provider model, global LLM_MODEL, provider default.

“测试模型连接”只测试全局模型，不自动调用全部角色。各角色实际供应商和模型保存在角色结果中。多供应商不保证去相关，也不自动提升质量。 / The connection test exercises the global model only. Role results retain actual provider/model. Multiple providers do not guarantee independent reasoning or improved quality.

## 搜索与验证范围｜Search and validation scope

MiniMax 联网检索与文本供应商配置独立：需要 `MINIMAX_API_KEY`、对应搜索权限和 `MINIMAX_WEB_SEARCH=true`。没有搜索 key 时继续用已采集行情/财务证据并标记缺失；其他供应商的内置搜索工具未在本项目启用。 / MiniMax search is independent of the text provider and requires its own credential/access. Missing search falls back to collected market/financial evidence with explicit warnings. Other providers' built-in search tools are not enabled.

**已实测 / Live tested:** MiniMax-M3 文本、完整八角色任务、受控实验。**协议测试 / Mock tested:** 所有注册适配器的请求构造、四类正文/usage 归一化、密钥隔离与拒绝任意域名跳转。其他供应商没有使用真实 key 的完整端到端实测。 / MiniMax has live tests; other providers have protocol and isolation tests rather than account-backed end-to-end verification.

其他官方入口 / Other official references: [MiniMax](https://platform.minimax.cn/docs/api-reference/text-openai-api), [Moonshot](https://platform.moonshot.cn/docs/intro), [Zhipu](https://docs.bigmodel.cn/), [SiliconFlow](https://docs.siliconflow.cn/docs/api/chat-completions-post), [OpenRouter](https://openrouter.ai/docs/quickstart), [Groq](https://console.groq.com/docs/openai), [xAI](https://docs.x.ai/docs/api-reference), [Volcengine Ark](https://www.volcengine.com/docs/82379).

端点默认要求官方 HTTPS；重定向被拒绝。本地适配器默认仅允许回环地址。自定义官方地址的绕过开关 `LLM_ALLOW_CUSTOM_ENDPOINTS=true` 仅用于你明确控制的端点，通常应改用独立 CUSTOM key。 / Cloud endpoints require official HTTPS by default and reject redirects. Local adapters default to loopback. Prefer isolated CUSTOM credentials for gateways instead of overriding official-key protections.
