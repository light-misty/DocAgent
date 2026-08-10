import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect, useCallback } from "react";
import { Icon } from "./Icon";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useToastStore } from "../../stores/useToastStore";
import type { ProviderInfo } from "../../types";
import { resolveReasoningEfforts } from "../../data/reasoningEfforts";
import { ThinkingEffortDropdown } from "./ThinkingEffortDropdown";

export function ProviderSelector({ dropdownUp = false }: { dropdownUp?: boolean }) {
  const { t } = useTranslation();
  const { llmProviders, preferredProviderId, setPreferredProviderId, openSettings, loadProviders } = useSettingsStore();
  const [open, setOpen] = useState(false);
  // 正在编辑思考强度的 Provider 及锚点位置（在按钮附近弹出下拉）
  const [effortPicker, setEffortPicker] = useState<{ provider: ProviderInfo; anchorRect: DOMRect } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 当前有效 Provider：优先使用用户选择，否则取列表第一个
  const currentProvider = llmProviders.find((p) => p.id === preferredProviderId)
    || llmProviders[0];

  /* 点击外部关闭下拉框（思考强度下拉渲染在本容器内，点击其内部不会触发） */
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
      // 思考强度下拉以 fixed 定位渲染：点击空白处一并关闭
      setEffortPicker(null);
    }
  }, []);

  /* 按 Escape 关闭下拉框 */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [open, handleClickOutside, handleKeyDown]);

  const handleSelect = (id: string) => {
    setPreferredProviderId(id);
    setOpen(false);
  };

  const noProvider = llmProviders.length === 0;

  return (
    <div ref={containerRef} className="provider-selector-container">
      <div
        role="button"
        aria-label={t('provider.selectModel')}
        tabIndex={0}
        className={`provider-selector-trigger ${open ? "provider-selector-trigger-active" : ""}`}
        onClick={() => {
          if (noProvider) {
            openSettings("llm");
          } else {
            setOpen((prev) => !prev);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (noProvider) {
              openSettings("llm");
            } else {
              setOpen((prev) => !prev);
            }
          }
        }}
      >
        <span className="provider-selector-label">{currentProvider?.name ?? t('provider.configureModel')}</span>
        <Icon name={noProvider ? "settings" : (open ? "chevron-up" : "chevron-down")} size={14} />
      </div>

      {open && !noProvider && (
        <div className={`provider-selector-dropdown ${dropdownUp ? "provider-selector-dropdown-up" : ""}`}>
          <div className="provider-selector-list">
            {llmProviders.map((provider) => (
              <div
                key={provider.id}
                className={`provider-selector-item ${provider.id === currentProvider?.id ? "provider-selector-item-active" : ""}`}
                onClick={() => handleSelect(provider.id)}
                role="option"
                aria-selected={provider.id === currentProvider?.id}
              >
                <div className="provider-selector-item-info">
                  <span className="provider-selector-item-name">{provider.name}</span>
                  <span className="provider-selector-item-model">{provider.model}</span>
                </div>
                {/* 思考强度编辑按钮：点击在按钮附近弹出档位下拉，模型下拉保持展开，不触发模型切换 */}
                <button
                  className="provider-selector-item-edit"
                  title={t('modelSettings.title')}
                  aria-label={t('modelSettings.title')}
                  onClick={(e) => {
                    e.stopPropagation();
                    // 模型不支持思考强度时提示，不打开下拉
                    if (!resolveReasoningEfforts(provider.model)) {
                      useToastStore.getState().addToast(
                        "warning",
                        t('slash.toast.effortNotSupported', { model: provider.model })
                      );
                      return;
                    }
                    setEffortPicker({
                      provider,
                      anchorRect: e.currentTarget.getBoundingClientRect(),
                    });
                  }}
                >
                  <Icon name="edit" size={13} />
                </button>
                {provider.id === currentProvider?.id && (
                  <Icon name="check" size={14} />
                )}
              </div>
            ))}
          </div>
          <div className="provider-selector-footer">
            <div className="provider-selector-divider" />
            <div
              className="provider-selector-configure"
              role="button"
              tabIndex={0}
              onClick={() => { setOpen(false); openSettings("llm"); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(false); openSettings("llm"); } }}
            >
              <Icon name="settings" size={14} />
              <span>{t('provider.configureModel')}</span>
            </div>
          </div>
        </div>
      )}

      {effortPicker && (
        <ThinkingEffortDropdown
          provider={effortPicker.provider}
          anchorRect={effortPicker.anchorRect}
          onClose={(e) => {
            setEffortPicker(null);
            // 点击模型下拉内部（如其他编辑按钮）时保留模型下拉；点击空白处时一并关闭
            if (containerRef.current && !containerRef.current.contains(e?.target as Node)) {
              setOpen(false);
            }
          }}
          onApplied={() => {
            setEffortPicker(null);
            // 刷新 Provider 列表，使新档位在重新打开时生效
            loadProviders();
          }}
        />
      )}

      <style>{`
        .provider-selector-container {
          position: relative;
        }
        .provider-selector-trigger {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: background 0.15s;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          white-space: nowrap;
          user-select: none;
        }
        .provider-selector-trigger:hover {
          background: var(--color-bg-sub);
        }
        .provider-selector-trigger-active {
          background: var(--color-bg-sub);
          color: var(--color-text-primary);
        }
        .provider-selector-label {
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .provider-selector-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          min-width: 220px;
          max-width: 300px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 200;
          animation: provider-dropdown-in 0.15s ease-out;
          overflow: hidden;
        }
        .provider-selector-dropdown-up {
          top: auto;
          bottom: calc(100% + 6px);
          animation-name: provider-dropdown-in-up;
        }
        @keyframes provider-dropdown-in {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes provider-dropdown-in-up {
          from { opacity: 0; transform: scale(0.96) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .provider-selector-list {
          max-height: 280px;
          overflow-y: auto;
          padding: 4px;
        }
        .provider-selector-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
        }
        .provider-selector-item:hover {
          background: var(--color-bg-hover);
        }
        .provider-selector-item-active {
          color: var(--color-accent);
        }
        .provider-selector-item-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
          flex: 1;
        }
        .provider-selector-item-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .provider-selector-item-edit {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--color-text-quaternary);
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .provider-selector-item-edit:hover {
          background: var(--color-bg-sub);
          color: var(--color-text-primary);
        }
        .provider-selector-item-model {
          font-size: 11px;
          color: var(--color-text-quaternary);
          font-family: var(--font-mono);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .provider-selector-footer {
          padding: 0 4px 4px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .provider-selector-divider {
          height: 1px;
          background: var(--color-border-light);
          margin: 0;
        }
        .provider-selector-configure {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          color: var(--color-text-tertiary);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .provider-selector-configure:hover {
          background: var(--color-bg-hover);
          color: var(--color-text-primary);
        }
      `}</style>
    </div>
  );
}
