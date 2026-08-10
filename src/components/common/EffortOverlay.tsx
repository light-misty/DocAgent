import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProviderInfo } from "../../types";
import { resolveReasoningEfforts, type ReasoningEffortLevel } from "../../data/reasoningEfforts";
import * as tauriCmd from "../../services/tauri";
import { useToastStore } from "../../stores/useToastStore";
import { parseError } from "../../services/errorHandler";
import { Icon } from "../common/Icon";

interface EffortOverlayProps {
  provider: ProviderInfo;
  onClose: () => void;
  /** 应用成功后回调（父组件负责刷新 Provider 列表等） */
  onApplied?: () => void;
}

/**
 * 思考强度设置窗口（/effort 命令触发）
 * 样式与斜杠命令帮助窗口一致：半透明遮罩 + 居中卡片
 */
export function EffortOverlay({ provider, onClose, onApplied }: EffortOverlayProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  // 当前生效档位：本地状态，选择档位后窗口保持打开并实时更新高亮
  const [current, setCurrent] = useState(provider.reasoningEffort);

  // 监听 Esc 键关闭窗口
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // 调用方已确认模型支持思考强度，此处防御性处理
  const levels = resolveReasoningEfforts(provider.model);

  // 点击档位：直接持久化应用，窗口保持打开（可继续调整或手动关闭）
  const handleSelect = async (level: ReasoningEffortLevel) => {
    if (saving) return;
    setSaving(true);
    try {
      // 编辑模式：API Key 传空字符串，后端保留原加密密钥
      await tauriCmd.updateProvider(provider.id, {
        name: provider.name,
        providerType: provider.providerType,
        apiBase: provider.apiBase,
        apiKey: "",
        model: provider.model,
        contextWindow: provider.contextWindow,
        supportsVision: provider.supportsVision,
        reasoningEffort: level,
      });
      // 更新本地高亮，窗口不关闭
      setCurrent(level);
      onApplied?.();
    } catch (err) {
      useToastStore
        .getState()
        .addToast("error", t("modelSettings.saveFailed", { error: parseError(err).userMessage }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" onClick={onClose}>
      <div
        className="relative flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border-light bg-bg-elevated shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏：与下方服务商名称之间无分隔线（收紧下边距保持视觉紧凑） */}
        <div className="flex items-center justify-between px-5 pt-3.5 pb-2">
          <h2 className="text-base font-bold text-text-primary">{t("modelSettings.title")}</h2>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
            onClick={onClose}
            aria-label={t("slash.help.close")}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* 当前模型信息 */}
        <div className="border-b border-border-light px-5 pt-1 pb-2.5 text-xs text-text-tertiary">
          {provider.name}
          <span className="font-mono">（{provider.model}）</span>
        </div>

        {/* 思考强度档位选择 */}
        <div className="grid grid-cols-2 gap-2 overflow-y-auto p-5">
          {levels?.map((level) => (
            <button
              key={level}
              type="button"
              disabled={saving}
              className={`flex h-9 items-center justify-between gap-2 rounded-md border px-3 text-[13px] transition-colors ${
                current === level
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border-light text-text-primary hover:bg-bg-hover"
              }`}
              onClick={() => handleSelect(level)}
            >
              <span>{t(`modelSettings.levels.${level}`)}</span>
              {current === level && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
