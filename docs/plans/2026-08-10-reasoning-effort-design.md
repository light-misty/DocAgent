# 模型思考强度（Reasoning Effort）功能设计

**目标**: 为每个模型（Provider）配置独立的思考强度档位，支持在新建会话页面的模型列表编辑按钮与 `/effort` 斜杠命令中调整，未收录模型视为"无思考强度"不显示选项

**架构**: 前端内置模型能力表（按模型名匹配档位）+ Provider 级持久化（`AdvancedConfig.reasoning_effort`）+ 三个适配器将档位转换为各 API 原生参数

**技术栈**: Rust (Tauri 命令/适配器) + React/TypeScript (Zustand store + CSS-in-JS)

---

## 一、调研结论（2026-08 官方文档验证）

> 用户主张已验证属实：思考强度是**模型级**能力，而非按供应商统一分配。各模型档位差异极大，部分模型（如 gpt-4o、claude-3.5 等）完全不支持。

### 各模型思考强度档位（官方数据）

### OpenAI 系

| 模型（关键词） | 可用档位 | API 参数形态 |
|---|---|---|
| GPT-5.2 及之后（含 GPT-5.6 系列） | `none`, `low`, `medium`, `high`, `xhigh` | `reasoning_effort` |
| GPT-5.6 Sol / Terra / Luna | `none`, `low`, `medium`, `high`, `xhigh`, `max` | `reasoning_effort` |
| Codex 模型（GPT-5.2 Codex 及之后） | `low`, `medium`, `high`, `xhigh` | `reasoning_effort` |
| GPT-5.1 Codex | `low`, `medium`, `high` | `reasoning_effort` |
| Pro 模型（GPT-5.5 Pro） | `medium`, `high`, `xhigh` | `reasoning_effort` |
| GPT-5 / GPT-5 mini / GPT-5 nano | `minimal`, `low`, `medium`, `high` | `reasoning_effort` |
| o 系列（o1, o3, o3-mini, o4-mini） | `low`, `medium`, `high` | `reasoning_effort` |
| gpt-5.4 / gpt-5.4-mini / gpt-5.4-nano | `none`, `low`, `medium`, `high`, `xhigh`（完整推理档位） | `reasoning_effort` |

> 注：GPT-5.6 系列于 2026-07-09 正式 GA。请求不支持的档位会返回错误并列出可用值。

### DeepSeek

| 模型（关键词） | 可用档位 | API 参数形态 |
|---|---|---|
| deepseek-v4-flash | `low`, `high`, `max`（`medium`/`xhigh` 映射） | `reasoning_effort` |
| deepseek-v4-pro | `high`, `max`（`low`→`high`，`xhigh`→`max`） | `reasoning_effort` |

> 注：思考模式默认打开，`effort` 默认为 `high`。思考模式下 `temperature`/`top_p` 不生效。

### Anthropic（Claude）

| 模型（关键词） | 可用档位 | API 参数形态 |
|---|---|---|
| Opus 4.0 / 4.1 | 无（早于 effort 支持） | — |
| Opus 4.5 | `low`, `medium`, `high` | `output_config.effort` |
| Opus 4.6 | `low`, `medium`, `high`, `max` | `output_config.effort` |
| Opus 4.7 / 4.8 | `low`, `medium`, `high`, `xhigh`, `max` | `output_config.effort` |
| Opus 5+ | `low`, `medium`, `high`, `xhigh`, `max` | `output_config.effort` |
| Sonnet 4.0 / 4.1 / 4.5 | 无（拒绝 effort） | — |
| Sonnet 4.6 | `low`, `medium`, `high`, `max` | `output_config.effort` |
| Sonnet 5+ | `low`, `medium`, `high`, `xhigh`, `max` | `output_config.effort` |
| Haiku 4.x | 无（官方 effort 支持列表不含 Haiku，发送会返回 400） | — |

> 注：Opus 4.7 起废弃固定 `budget_tokens`，改用 `output_config.effort`。`xhigh` 专为长期编码和代理任务设计。`max` 官方描述为"容易过度思考"。effort 参数已 GA，全部支持模型无需 beta header（Opus 4.5 早期 beta 期需 `effort-2025-11-24` 头，现已取消）。

### Google Gemini

| 模型（关键词） | 可用档位 | API 参数形态 |
|---|---|---|
| Gemini 2.5 Pro | `low`, `medium`, `high`（动态默认，不支持 `minimal`） | `thinkingConfig.thinkingBudget`（128–32768） |
| Gemini 2.5 Flash | `low`, `medium`, `high`（动态默认） | `thinkingConfig.thinkingBudget`（0–24576） |
| Gemini 2.5 Flash Lite | `low`, `medium`, `high`（默认不思考） | `thinkingConfig.thinkingBudget`（512–24576） |
| Gemini 3.x / 3.5 Flash | `minimal`, `low`, `medium`, `high` | `thinkingConfig.thinkingLevel` |
| Gemini 3.1 Pro | `low`, `medium`, `high`（不支持 `minimal`） | `thinkingConfig.thinkingLevel` |

> 注：Gemini 2.5 用 `thinkingBudget`，Gemini 3 用 `thinkingLevel`，不可混用。`thinkingBudget=0` 关闭思考，`-1` 动态思考。Pro 模型默认 `high`，Flash 默认 `high`（Gemini 3）/ `medium`（3.5），Flash-Lite 默认 `minimal`。

### xAI Grok

| 模型（关键词） | 可用档位 | API 参数形态 |
|---|---|---|
| Grok 4.3 | `none`, `low`, `medium`, `high` | `reasoning_effort` |
| Grok 4.5 | `low`, `medium`, `high`（默认 `high`） | `reasoning_effort` |

> 注：Grok 4.5 于 2026-07-08 GA。Grok 3 被归类为 Grok 4.3 别名，同样支持完整档位。

### Mistral

| 模型（关键词） | 可用档位 | API 参数形态 |
|---|---|---|
| Mistral Small 4（mistral-small-2603） | `none`, `high`（仅两档） | `reasoning_effort` |
| Magistral 系列 | 无（原生推理，不接收参数） | — |

> 注：Mistral Small 4 的 `none` 等同于 Mistral Small 3.2 的聊天风格，`high` 提供与之前 Magistral 模型相当的详细程度。

### 国内模型

| 模型（关键词） | 可用档位 | API 参数形态 |
|---|---|---|
| Kimi K3 | `low`, `high`, `max`（默认 `max`） | `reasoning_effort` |
| Kimi K2.7-code | 不支持（始终思考） | — |
| GLM-5.2 | `high`, `max`（默认 `max`）；`off` 用 `thinking.type: disabled` 关闭思考 | `reasoning_effort` |
| Qwen 3（DashScope） | 仅布尔值 `enable_thinking`（无档位） | — |
| 蚂蚁百灵 Ring-2.6-1T | `high`, `xhigh` | `reasoning_effort` |

> 注：Kimi K3 始终推理，切换档位可能影响缓存命中。Qwen 混合模型通过 `enable_thinking` 开启/关闭思考。GLM-5 / 5.1 官方不支持 `reasoning_effort`（智谱文档标注仅 GLM-5.2 及以上支持；GLM-5 开源部署仅接受 `max`/`high`，设置其他值按 `max` 运行），故不收录。

### 其他平台与模型

| 模型/平台（关键词） | 可用档位 | API 参数形态 |
|---|---|---|
| Fireworks（DeepSeek V4 Pro / GLM-5.1 / GPT-OSS 120B） | `low`, `medium`, `high`, `xhigh`, `max` | `reasoning_effort` |
| Groq（Qwen3 等推理模型） | `none`, `default`（仅两值，不接受 low/medium/high） | `reasoning_effort` |
| Together AI（GPT-OSS 120B / GLM-5.2 / Inkling） | `low`, `medium`, `high` | `reasoning_effort` |
| OpenRouter | 统一 `reasoning: { effort }` 对象，支持 `none`/`minimal`/`low`/`medium`/`high`/`xhigh` | 嵌套 `reasoning` 对象 |
| Perplexity（Sonar Reasoning Pro） | `minimal`, `low`, `medium`, `high` | `reasoning_effort` |
| Cohere（Command A+） | `minimal`, `low`, `medium`, `high`, `xhigh` → 映射为 `thinking.token_budget` | `reasoning_effort` |

> 注：Fireworks 支持 `xhigh`/`max` 等扩展档位。Groq API 对 `reasoning_effort` 有严格限制，仅接受 `none` 或 `default`。OpenRouter 使用嵌套 `reasoning` 对象而非顶层 `reasoning_effort`。

### 关键约束
- **Anthropic**：发送 `output_config.effort` 时移除 `temperature` / `top_p`（与 extended thinking 一致的保守策略）；`effort` 已 GA 无需 beta header
- **OpenAI 推理模型**：Chat Completions 端点不支持 `temperature` / `top_p`（部分报错）；gpt-5.4+ 的 `tools` 与 `reasoning_effort` 非 `none` 时互斥（本项目有工具调用，需注意——默认不设置 `reasoning_effort` 时不受影响，显式设置时用户自行承担）
- **DeepSeek**：思考模式下 `temperature` / `top_p` 无效但不报错；思考默认开启，`thinking.type=disabled` 可关闭
- **Gemini**：`thinkingBudget`（2.5）与 `thinkingLevel`（3）不可混用；`thinkingBudget=0` 关闭、`-1` 动态
- 动态探测不可行：OpenAI / Anthropic / Gemini / DeepSeek 的 `/v1/models` 均不返回思考能力元数据

## 二、内置模型能力表

新建 `src/data/reasoningEfforts.ts`：

```typescript
/** 单个档位条目：模型名匹配规则 + 档位列表 */
interface ReasoningEffortRule {
  /** 模型名包含任一关键词（不区分大小写）即命中 */
  match: string[];
  /** 档位列表（UI 顺序 = 强度从低到高） */
  efforts: string[];
}
```

规则顺序即优先级（从具体到一般），`resolveReasoningEfforts(model)` 返回 `string[] | null`（null = 无思考强度）。档位仅存字符串，各适配器自行转换。

## 三、数据模型变更

### Rust 端
- `src-tauri/src/config/llm_config.rs` `AdvancedConfig` 增加 `reasoning_effort: Option<String>`（`#[serde(default)]`，None = 跟随模型默认/不发送参数）
- `src-tauri/src/models/llm.rs` `ProviderConfig` 增加 `reasoning_effort: Option<String>`
- `src-tauri/src/services/llm/router.rs` `ProviderMeta` 增加 `reasoning_effort: Option<String>`（随 `list_providers` 返回）
- `src-tauri/src/commands/llm.rs` `add_provider` / `update_provider`：透传 `reasoning_effort`（update 时 None 保留原值，与 `context_window` 逻辑一致）

### 前端
- `src/types/settings.ts` `ProviderConfig` / `ProviderInfo` 增加 `reasoningEffort?: string | null`
- `src/services/tauri.ts` 无需新命令：复用 `updateProvider`（apiKey 传空串，后端保留原值）

## 四、适配器参数转换（Rust）

各 adapter 的 `build_request_body` 根据 `self.advanced.reasoning_effort` 追加参数；`None` 时完全不加，保证不破坏现有行为：

### OpenAiAdapter（openai / custom / ollama）
- 档位存在且非 `off`：`body["reasoning_effort"] = value`；**跳过** `temperature` / `top_p`
- `off` 档：
  - API base 含 `deepseek` 或模型名含 `glm` → `body["thinking"] = {"type": "disabled"}`（保留 temperature/top_p；DeepSeek 思考默认开启，GLM-5.2 官方推荐用该方式关闭思考）
  - 其他 → `body["reasoning_effort"] = "none"`；跳过 temperature/top_p

### AnthropicAdapter
- 档位存在且非 `off`：`body["output_config"] = {"effort": value}`（官方推荐参数形态，直接透传，替代废弃的 budget_tokens 换算）；**跳过** `temperature` / `top_p`
- `off` / None：不发送 effort（模型默认 `high`，保持现有行为）

### GeminiAdapter
- 档位存在且非 `off`：
  - 模型名含 `gemini-3` → `thinkingConfig.thinkingLevel = value`（大写）
  - 其他（2.5 系）→ `thinkingConfig.thinkingBudget = N`：`low→1024`，`medium→8192`，`high→24576`（clamp 到 `[128, 32768]`），`max→32768`
- `off` → 2.5 系 `thinkingBudget: 0`；3 系 `thinkingLevel: "minimal"`
- 保留 temperature/topP（Gemini 允许）

## 五、前端 UI

### 1. ProviderSelector 每项编辑按钮
- 每个模型项右侧（勾选图标旁）增加编辑按钮（`edit` 图标），`onClick` 阻止冒泡，打开 `ModelSettingsDialog`
- 选中态勾选图标改为仅 hover 显示或与编辑按钮并存（选中项显示勾，其他项 hover 显示编辑按钮）

### 2. ModelSettingsDialog（新组件 `src/components/common/ModelSettingsDialog.tsx`）
- 标题：模型名 + Provider 名
- **思考强度**区域（仅当 `resolveReasoningEfforts(model)` 非空时显示）：
  - 档位按钮组：「跟随默认」+ 各档位按钮；选中态高亮
  - 每档位下方显示能力水平描述（i18n：如"深度推理，适合复杂任务"）
- **上下文窗口**区域：输入框 + 预设按钮（复用 ProviderFormDialog 的 `parseContextWindow` / `formatContextWindow` / `CONTEXT_PRESETS` 逻辑）
- 保存：构造 `ProviderConfig`（name/providerType/apiBase/model/contextWindow/supportsVision 取自 ProviderInfo，apiKey 留空，reasoningEffort 为新值）→ `updateProvider` → 刷新 provider 列表
- 无思考强度模型：只显示上下文区域，不显示思考强度区域

### 3. `/effort` 斜杠命令
- 注册到 `SLASH_COMMANDS`（`allowedInAgent: false`）
- `App.tsx` `executeSlashCommand` 增加 `case "effort"`：
  - 参数为空 → Toast 展示当前档位 + 可用档位列表
  - 参数为合法档位 → `updateProvider` 持久化 → Toast 成功
  - 当前模型无思考强度 → Toast"当前模型不支持思考强度"
- 新建会话页（centered）不隐藏该命令（输入 `/effort` 可提前设置）

## 六、i18n

zh-CN / en-US 新增：
- `provider.editModel`（编辑模型）、`provider.reasoningEffort`（思考强度）、`provider.followDefault`（跟随默认）、各档位描述
- `slash.commands.effort.desc` / `.argHint`、`slash.toast.*`（effort 相关提示）
- `settings.providerForm` 无改动

## 七、测试计划

Rust 单元测试（adapter 现有 `#[cfg(test)]` 模块）：
1. OpenAI 兼容：设置 `reasoning_effort=high` → body 含 `reasoning_effort` 且无 `temperature`；`off` + deepseek → `thinking.type=disabled`
2. Anthropic：`high` → `output_config.effort="high"` 且无 `temperature`/`top_p`；`None` → 无 `output_config` 字段
3. Gemini：`high` + gemini-2.5 → `thinkingBudget=24576`；`low` + gemini-3 → `thinkingLevel="LOW"`；`off` → `thinkingBudget=0`
4. `None`（未设置）时三个 adapter 请求体与现有逻辑完全一致（回归）

前端无测试框架（项目约定），通过 `npm run build` 验证类型。
