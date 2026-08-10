# 模型思考强度（Reasoning Effort）功能设计

**目标**: 为每个模型（Provider）配置独立的思考强度档位，支持在新建会话页面的模型列表编辑按钮与 `/effort` 斜杠命令中调整，未收录模型视为"无思考强度"不显示选项

**架构**: 前端内置模型能力表（按模型名匹配档位）+ Provider 级持久化（`AdvancedConfig.reasoning_effort`）+ 三个适配器将档位转换为各 API 原生参数

**技术栈**: Rust (Tauri 命令/适配器) + React/TypeScript (Zustand store + CSS-in-JS)

---

## 一、调研结论（2026-08 官方文档验证）

> 用户主张已验证属实：思考强度是**模型级**能力，而非按供应商统一分配。各模型档位差异极大，部分模型（如 gpt-4o、claude-3.5 等）完全不支持。

### 各模型思考强度档位（官方数据）

| 模型（关键词） | 可用档位 | API 参数形态 |
|---|---|---|
| deepseek-v4-flash / v4-pro / v3.2 | `high`, `max`（low/medium→high，xhigh→max） | OpenAI 格式 `reasoning_effort` + `thinking.type` 开关 |
| o1 / o3 / o4-mini | `low`, `medium`, `high` | `reasoning_effort` |
| gpt-5 | `minimal`, `low`, `medium`, `high` | `reasoning_effort` |
| gpt-5.1 系（含 codex） | `none`, `low`, `medium`, `high`（codex-max 加 `xhigh`） | `reasoning_effort` |
| gpt-5.2 系 | `none`, `low`, `medium`, `high`, `xhigh` | `reasoning_effort` |
| gpt-5.6 系 | `none`, `low`, `medium`, `high`, `xhigh`, `max` | `reasoning_effort` |
| gpt-5-pro | 仅 `high` | `reasoning_effort` |
| claude-sonnet-4.x / 4.5 / 4.6 / haiku-4.5 | `low`, `medium`, `high`（Sonnet 无 max） | Messages `thinking.budget_tokens` 或 `adaptive` + `output_config.effort` |
| claude-opus-4.x / 4.6 / 4.7 | `low`, `medium`, `high`, `max` | 同上（4.7/4.8 仅 adaptive） |
| claude-sonnet-5 / opus-5 | `low`, `medium`, `high`, `max`（默认 high） | `thinking` adaptive |
| gemini-2.5-pro / flash | `low`, `medium`, `high`（动态默认） | `thinkingConfig.thinkingBudget` |
| gemini-2.5-flash-lite | `low`, `medium`, `high`（默认不思考） | 同上 |
| gemini-3 系 | `minimal`, `low`, `medium`, `high`（3.1-pro 仅 low/medium/high） | `thinkingConfig.thinkingLevel` |
| doubao-seed 系 | `minimal`, `low`, `medium`, `high` | `reasoning.effort`（OpenAI 兼容） |

### 关键约束
- **Anthropic**：开启 thinking 时**禁止**传 `temperature` / `top_p`（否则 400）；`budget_tokens` 必须小于 `max_tokens`
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
  - API base 含 `deepseek` → `body["thinking"] = {"type": "disabled"}`（保留 temperature/top_p，DeepSeek 不报错）
  - 其他 → `body["reasoning_effort"] = "none"`；跳过 temperature/top_p

### AnthropicAdapter
- 档位存在且非 `off`：`body["thinking"] = {"type": "enabled", "budget_tokens": N}`；**跳过** `temperature` / `top_p`
  - budget 换算（参考 Requesty/liteLLM 标准）：`low→1024`，`medium→8192`，`high→16384`，`max→max_tokens-1`
- `off` / None：不发送 thinking（保持现有行为）

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
2. Anthropic：`high` → `thinking.budget_tokens=16384` 且无 `temperature`/`top_p`；`None` → 无 thinking 字段
3. Gemini：`high` + gemini-2.5 → `thinkingBudget=24576`；`low` + gemini-3 → `thinkingLevel="LOW"`；`off` → `thinkingBudget=0`
4. `None`（未设置）时三个 adapter 请求体与现有逻辑完全一致（回归）

前端无测试框架（项目约定），通过 `npm run build` 验证类型。
