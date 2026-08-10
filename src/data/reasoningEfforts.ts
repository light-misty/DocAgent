// ===== 思考强度（reasoning effort）内置模型能力表 =====
// 思考强度由模型本身支持与否决定，不同模型支持不同档位。
// 此表在前端根据当前模型名匹配可用的档位列表，无匹配的模型不提供思考强度设置。
// 规则顺序即优先级（从具体到一般），先命中的规则生效。
// 档位数据来源于设计文档 docs/plans/2026-08-10-reasoning-effort-design.md 的调研表，
// 并经官方文档联网核实修正（Haiku 4.x 不支持 effort、GLM 仅 5.2 支持档位等）。

export type ReasoningEffortLevel =
  | "off"
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/** 档位匹配规则：模型名包含任一关键词（不区分大小写）即命中 */
interface ReasoningEffortRule {
  match: string[];
  /** 档位列表（UI 顺序 = 强度从低到高） */
  efforts: ReasoningEffortLevel[];
}

/** 内置模型档位表（按模型名匹配，规则从具体到一般） */
const EFFORT_MODEL_RULES: ReasoningEffortRule[] = [
  // ---- OpenAI GPT-5.6 系列（含 Sol/Terra/Luna，2026-07-09 GA，新增 max 档位）----
  { match: ["gpt-5.6"], efforts: ["none", "low", "medium", "high", "xhigh", "max"] },
  // ---- OpenAI GPT-5.5 Pro（无 none/minimal/low）----
  { match: ["gpt-5.5"], efforts: ["medium", "high", "xhigh"] },
  // ---- OpenAI GPT-5.4 系列（完整推理档位，含 mini/nano）----
  { match: ["gpt-5.4"], efforts: ["none", "low", "medium", "high", "xhigh"] },
  // ---- OpenAI GPT-5.1 Codex（无 xhigh）----
  { match: ["gpt-5.1-codex"], efforts: ["low", "medium", "high"] },
  // ---- OpenAI Codex（GPT-5.2 Codex 及之后）----
  { match: ["codex"], efforts: ["low", "medium", "high", "xhigh"] },
  // ---- OpenAI GPT-5.2 系列----
  { match: ["gpt-5.2"], efforts: ["none", "low", "medium", "high", "xhigh"] },
  // ---- OpenAI GPT-5 / mini / nano（minimal 为最低档，无 none/max）----
  { match: ["gpt-5"], efforts: ["minimal", "low", "medium", "high"] },
  // ---- OpenAI o 系列（旧推理模型，无关闭/无 max；o1 为文档遗漏的补充收录）----
  { match: ["o1", "o3", "o4-mini"], efforts: ["low", "medium", "high"] },
  // ---- DeepSeek V4 Flash（原生三档 low/high/max；off 通过 thinking.type=disabled 关闭）----
  { match: ["deepseek-v4-flash"], efforts: ["off", "low", "high", "max"] },
  // ---- DeepSeek V4 Pro（原生 high/max，low/medium/xhigh 为服务端兼容映射，不列）----
  { match: ["deepseek-v4"], efforts: ["off", "high", "max"] },
  // ---- Anthropic Opus 4.7 / 4.8 / 5、Sonnet 5、Fable 5（全档位，不可关闭思考故无 off）----
  {
    match: [
      "claude-opus-4-8", "claude-opus-4.8", "claude-opus-4-7", "claude-opus-4.7",
      "claude-opus-5", "claude-sonnet-5", "claude-fable-5",
    ],
    efforts: ["low", "medium", "high", "xhigh", "max"],
  },
  // ---- Anthropic Opus 4.6 / Sonnet 4.6（无 xhigh）----
  {
    match: ["claude-opus-4-6", "claude-opus-4.6", "claude-sonnet-4-6", "claude-sonnet-4.6"],
    efforts: ["low", "medium", "high", "max"],
  },
  // ---- Anthropic Opus 4.5（无 xhigh/max）----
  { match: ["claude-opus-4-5", "claude-opus-4.5"], efforts: ["low", "medium", "high"] },
  // ---- Gemini 2.5 Pro（thinkingBudget 128-32768，不可关闭思考）----
  { match: ["gemini-2.5-pro"], efforts: ["low", "medium", "high"] },
  // ---- Gemini 2.5 Flash Lite（thinkingBudget 512-24576，不可设 0 关闭）----
  { match: ["gemini-2.5-flash-lite"], efforts: ["low", "medium", "high"] },
  // ---- Gemini 2.5 Flash（thinkingBudget 0-24576，off 用 0 关闭思考）----
  { match: ["gemini-2.5-flash"], efforts: ["off", "low", "medium", "high"] },
  // ---- Gemini 3.1 Pro（thinkingLevel，不支持 minimal 且不可关闭思考）----
  { match: ["gemini-3.1-pro"], efforts: ["low", "medium", "high"] },
  // ---- Gemini 3.x / 3.5 Flash（thinkingLevel，minimal 为最低档，不可完全关闭）----
  { match: ["gemini-3"], efforts: ["minimal", "low", "medium", "high"] },
  // ---- xAI Grok 4.5（默认 high，不可关闭思考）----
  { match: ["grok-4.5"], efforts: ["low", "medium", "high"] },
  // ---- xAI Grok 4.3 / Grok 3（none 关闭推理；Grok 3 为 4.3 别名）----
  { match: ["grok-4.3", "grok-4", "grok-3"], efforts: ["none", "low", "medium", "high"] },
  // ---- Mistral Small 4（仅 none/high 两档，none 等于聊天风格）----
  { match: ["mistral-small-4", "mistral-small-2603"], efforts: ["none", "high"] },
  // ---- Kimi K3（默认 max，始终推理）----
  { match: ["kimi-k3"], efforts: ["low", "high", "max"] },
  // ---- GLM-5.2（off 关闭思考；GLM-5/5.1 官方不支持 reasoning_effort）----
  { match: ["glm-5.2"], efforts: ["off", "high", "max"] },
  // ---- 蚂蚁百灵 Ring-2.6（仅 high/xhigh 两档）----
  { match: ["ring-2.6"], efforts: ["high", "xhigh"] },
];

/**
 * 根据模型名查询支持的档位列表。
 * @param model 模型名称（如 "deepseek-v4-pro"）
 * @returns 支持的档位数组；模型不支持思考强度时返回 null（前端不显示设置入口）
 */
export function resolveReasoningEfforts(model: string): ReasoningEffortLevel[] | null {
  const lower = model.toLowerCase();
  const rule = EFFORT_MODEL_RULES.find((r) => r.match.some((k) => lower.includes(k)));
  return rule ? rule.efforts : null;
}
