// ===== 思考强度（reasoning effort）内置模型能力表 =====
// 思考强度由模型本身支持与否决定，不同模型支持不同档位。
// 此表在前端根据当前模型名匹配可用的档位列表，无匹配的模型不提供思考强度设置。
// 规则顺序即优先级（从具体到一般），先命中的规则生效。

export type ReasoningEffortLevel = "off" | "low" | "medium" | "high" | "max";

/** 档位匹配规则：模型名包含任一关键词（不区分大小写）即命中 */
interface ReasoningEffortRule {
  match: string[];
  /** 档位列表（UI 顺序 = 强度从低到高） */
  efforts: ReasoningEffortLevel[];
}

/** 内置模型档位表（按模型名匹配，规则从具体到一般） */
const EFFORT_MODEL_RULES: ReasoningEffortRule[] = [
  // ---- DeepSeek V4 / V3.2（thinking 开关 + 档位；low/medium 归一化为 high）----
  { match: ["deepseek-v4", "deepseek-v3.2"], efforts: ["off", "high", "max"] },
  // ---- OpenAI o 系列（旧推理模型，无 off/max）----
  { match: ["o1", "o3", "o4-mini"], efforts: ["off", "low", "medium", "high"] },
  // ---- OpenAI gpt-5 系列（按版本档位递增）----
  { match: ["gpt-5.6", "gpt-5.2"], efforts: ["off", "low", "medium", "high", "max"] },
  { match: ["gpt-5.1"], efforts: ["off", "low", "medium", "high"] },
  { match: ["gpt-5-pro"], efforts: ["off", "high"] },
  { match: ["gpt-5"], efforts: ["off", "low", "medium", "high"] },
  // ---- Anthropic Claude（Sonnet 无 max，Opus 有 max）----
  { match: ["claude-sonnet-5", "claude-opus-5"], efforts: ["off", "low", "medium", "high", "max"] },
  { match: ["claude-opus"], efforts: ["off", "low", "medium", "high", "max"] },
  { match: ["claude-sonnet"], efforts: ["off", "low", "medium", "high"] },
  { match: ["claude-haiku"], efforts: ["off", "low", "medium", "high"] },
  { match: ["claude"], efforts: ["off", "low", "medium", "high"] },
  // ---- Gemini 2.5 / 3 系（2.5 用 thinkingBudget，3 用 thinkingLevel）----
  { match: ["gemini-2.5-flash-lite"], efforts: ["off", "low", "medium", "high"] },
  { match: ["gemini-2.5"], efforts: ["off", "low", "medium", "high"] },
  { match: ["gemini-3.1-pro"], efforts: ["off", "low", "medium", "high"] },
  { match: ["gemini-3"], efforts: ["off", "low", "medium", "high"] },
  // ---- 豆包 doubao-seed（OpenAI 兼容 reasoning.effort）----
  { match: ["doubao-seed"], efforts: ["off", "low", "medium", "high"] },
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
