import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProviderInfo } from "../../types";
import { resolveReasoningEfforts, type ReasoningEffortLevel } from "../../data/reasoningEfforts";
import * as tauriCmd from "../../services/tauri";
import { useToastStore } from "../../stores/useToastStore";
import { parseError } from "../../services/errorHandler";
import { Icon } from "../common/Icon";

interface ThinkingEffortDropdownProps {
  provider: ProviderInfo;
  /** 锚点矩形（编辑按钮位置），用于下拉定位 */
  anchorRect: DOMRect;
  /** 关闭回调：携带触发事件（点击关闭时），父组件可据此判断是否联动关闭兄弟下拉 */
  onClose: (e?: MouseEvent) => void;
  /** 应用成功后回调（父组件负责刷新 Provider 列表等） */
  onApplied?: () => void;
}

/**
 * 思考强度档位下拉列表
 * 点击档位后直接持久化应用并关闭（无保存/取消按钮），样式参考 ProviderSelector 下拉
 */
export function ThinkingEffortDropdown({
  provider,
  anchorRect,
  onClose,
  onApplied,
}: ThinkingEffortDropdownProps) {
  const { t } = useTranslation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [posStyle, setPosStyle] = useState<React.CSSProperties>({ visibility: "hidden" });
  const [saving, setSaving] = useState(false);

  // 根据锚点计算下拉位置
  // 使用 useLayoutEffect 在浏览器绘制前完成定位，避免首帧闪烁
  useLayoutEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    // 优先显示在锚点右侧（超出屏幕时回退到左侧），垂直方向优先显示在锚点下方
    let left = anchorRect.right + 6;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(anchorRect.left - width - 6, 8);
    }
    const top = window.innerHeight - anchorRect.bottom < height + 6
      ? Math.max(anchorRect.top - height - 6, 8)
      : anchorRect.bottom + 6;
    setPosStyle({ position: "fixed", top, left, visibility: "visible" });
  }, [anchorRect]);

  // 点击下拉外部或按 Escape 关闭
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose(e);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // 调用方已确认模型支持思考强度，此处防御性处理
  const levels = resolveReasoningEfforts(provider.model);
  const current = provider.reasoningEffort;

  // 点击档位：直接持久化应用并关闭
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
    <div
      className="ted-dropdown"
      ref={dropdownRef}
      style={posStyle}
      role="listbox"
      aria-label={`${provider.name} ${t("modelSettings.title")}`}
    >
      {levels?.map((level) => (
        <div
          key={level}
          role="option"
          aria-selected={current === level}
          className={`ted-item ${current === level ? "ted-item-active" : ""}`}
          onClick={() => handleSelect(level)}
        >
          <span>{t(`modelSettings.levels.${level}`)}</span>
          {current === level && <Icon name="check" size={14} />}
        </div>
      ))}

      <style>{`
        .ted-dropdown {
          min-width: 160px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 300;
          padding: 4px;
          animation: ted-dropdown-in 0.15s ease-out;
        }
        @keyframes ted-dropdown-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ted-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 3px 10px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: background 0.15s;
        }
        .ted-item:hover {
          background: var(--color-bg-hover);
        }
        .ted-item-active {
          color: var(--color-accent);
        }
      `}</style>
    </div>
  );
}
