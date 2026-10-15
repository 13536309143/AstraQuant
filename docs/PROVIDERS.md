# Model provider configuration

**English** | [简体中文](PROVIDERS.zh-CN.md)

[Documentation](README.md) · [Project home](../README.md)

`callProvider(messages, { role, maxTokens, signal })` normalizes invocation while keeping request formats and credentials separate. A provider's credential is never automatically reused by another provider.

## Configuration

Select a provider and configure its key/model. Use an enabled model ID from your account rather than assuming access to a particular latest model. Restart after editing.

Set `LLM_PROVIDER`, the matching `*_API_KEY` and `*_MODEL`, and optionally `*_BASE_URL`. Unset optional settings retain the defaults shown below.

| LLM_PROVIDER | Environment prefix | Protocol | Default base URL |
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
| azure | AZURE | Azure Chat v1 | Configure resource root |
| ollama | OLLAMA | Local Chat-compatible | http://127.0.0.1:11434/v1 |
| custom | CUSTOM | Chat-compatible | Configure trusted gateway |

Only MiniMax, DeepSeek and Qwen have convenience defaults. Other providers require explicit models. Provider aliases and access may change.

## Examples

Choose one global configuration below.

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=your_enabled_model_id
# Optional; only for models supporting it
# OPENAI_REASONING_EFFORT=low
```

OpenAI uses Responses with `store:false` and `max_output_tokens`, omitting optional sampling settings by default. Only text output is extracted. See [official text generation documentation](https://developers.openai.com/api/docs/guides/text).

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

Claude uses its native Messages schema; Gemini uses generateContent fields and its own authentication header. Thought blocks are excluded. See [Claude Messages](https://platform.claude.com/docs/en/api/messages/create) and [Gemini generateContent](https://ai.google.dev/api/generate-content).

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

Qwen key and endpoint regions must match. Thinking is disabled in the adapter to reserve the output budget for report text. See [DeepSeek](https://api-docs.deepseek.com/) and [Qwen compatibility](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope).

```dotenv
LLM_PROVIDER=azure
AZURE_API_KEY=your_azure_key
AZURE_BASE_URL=https://your-resource.openai.azure.com
AZURE_MODEL=your_deployment_name
# Optional legacy deployment API; otherwise uses /openai/v1/chat/completions
# AZURE_API_VERSION=2024-10-21
```

Azure model means deployment name; use the resource root as base URL. See [Azure Chat REST](https://learn.microsoft.com/en-us/azure/foundry/openai/latest).

```dotenv
LLM_PROVIDER=ollama
OLLAMA_MODEL=your_installed_model_tag
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
MINIMAX_WEB_SEARCH=false
```

Install and serve a suitable model in Ollama first. For Docker-to-host access, configure the host endpoint and explicitly enable local-network access; Linux may need host-gateway mapping. See [Ollama compatibility](https://docs.ollama.com/api/openai-compatibility).

```dotenv
LLM_PROVIDER=custom
CUSTOM_BASE_URL=https://your-trusted-gateway.example/v1
CUSTOM_API_KEY=your_gateway_key
CUSTOM_MODEL=your_gateway_model
# Some gateways require this instead of max_tokens:
# CUSTOM_TOKEN_PARAMETER=max_completion_tokens
```

Custom gateways use Chat Completions. Local vLLM-compatible servers may use the local `ollama` adapter; cloud gateways use a separate CUSTOM credential.

## Per-role routing

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

Available role IDs: `fundamental industry macro technical valuation risk skeptic committee`. Model precedence: role override, provider model, global `LLM_MODEL`, provider default.

The connection test exercises the global model only. Role results retain actual provider/model. Multiple providers do not guarantee independent reasoning or improved quality.

## Search and validation scope

MiniMax search is independent of the text provider and requires `MINIMAX_API_KEY`, search access and `MINIMAX_WEB_SEARCH=true`. Missing search falls back to collected market/financial evidence with explicit warnings. Other providers' built-in search tools are not enabled.

**Live tested:** MiniMax-M3 text generation, full eight-role jobs and controlled experiments. **Mock tested:** request construction for every adapter, response/usage normalization for the four core protocol families, key isolation and rejection of arbitrary redirects. Other providers have no account-backed end-to-end verification.

Other official references: [MiniMax](https://platform.minimax.cn/docs/api-reference/text-openai-api), [Moonshot](https://platform.moonshot.cn/docs/intro), [Zhipu](https://docs.bigmodel.cn/), [SiliconFlow](https://docs.siliconflow.cn/docs/api/chat-completions-post), [OpenRouter](https://openrouter.ai/docs/quickstart), [Groq](https://console.groq.com/docs/openai), [xAI](https://docs.x.ai/docs/api-reference), [Volcengine Ark](https://www.volcengine.com/docs/82379).

Cloud endpoints require official HTTPS by default and reject redirects. Local adapters default to loopback. Prefer isolated CUSTOM credentials for gateways instead of overriding official-key protections.

`LLM_ALLOW_CUSTOM_ENDPOINTS=true` bypasses the official-host restriction and should only point to an endpoint you control. `LLM_ALLOW_LOCAL_NETWORK=true` permits explicitly configured non-loopback local inference endpoints.
