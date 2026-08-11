import { useEffect, useRef, useCallback, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { SlashCommand } from "../../commands/slashCommands";
import type { SkillInfo } from "../../types";
import { useSuperpowersStore } from "../../stores/useSuperpowersStore";
import { useThinkingDisplayStore } from "../../stores/useThinkingDisplayStore";
import { BUILTIN_SUPERPOWERS_NAME } from "../../commands/superpowersContent";

interface SlashCommandMenuProps {
  /** 过滤后的命令列表 */
  commands: SlashCommand[];
  /** 可用 Skill 列表 */
  skills: SkillInfo[];
  /** 当前高亮项索引 */
  highlightIndex: number;
  /** 选择命令时的回调 */
  onSelect: (command: SlashCommand) => void;
  /** 选择 Skill 时的回调 */
  onSkillSelect: (skill: SkillInfo) => void;
  /** 关闭菜单的回调（点击菜单外部触发） */
  onClose: () => void;
  /** Agent 是否正在运行（用于禁用某些命令的显示） */
  agentRunning: boolean;
  /** 是否从上方弹出（历史会话页面为 true，新建会话页面为 false） */
  dropdownUp?: boolean;
  /** 水平对齐方式：left 靠左（输入框输入 / 触发），right 靠右（点击按钮触发），默认 left */
  align?: "left" | "right";
  /** 触发菜单的锚点元素（用于 fixed 定位计算），为 null 时不渲染菜单 */
  anchorEl: HTMLElement | null;
}

interface RenderItem {
  kind: "divider" | "command" | "skill" | "empty";
  cmd?: SlashCommand;
  skill?: SkillInfo;
}

/**
 * 构建拍平后的渲染项列表
 * 结构: [skill1, skill2, ..., 分隔线, command1, command2, ...]
 */
function buildRenderItems(commands: SlashCommand[], skills: SkillInfo[]): RenderItem[] {
  const items: RenderItem[] = [];
  if (commands.length === 0 && skills.length === 0) {
    items.push({ kind: "empty" });
    return items;
  }
  if (skills.length > 0) {
    for (const s of skills) {
      items.push({ kind: "skill", skill: s });
    }
    items.push({ kind: "divider" });
  }
  for (const cmd of commands) {
    items.push({ kind: "command", cmd });
  }
  return items;
}

/**
 * 斜杠命令选择菜单
 *
 * 在用户输入 / 时弹出，展示匹配的 Skill 和命令列表供用户选择。
 * Skills 在上方，Commands 在下方，中间用分隔线隔开。
 * 键盘导航（上下键/回车）由父组件 InputArea 处理并更新 highlightIndex，
 * 本组件只负责渲染高亮状态、自动滚动以及鼠标点击交互。
 */
export function SlashCommandMenu(props: SlashCommandMenuProps) {
  const { commands, skills, highlightIndex, onSelect, onSkillSelect, onClose, agentRunning, dropdownUp = true, align = "left", anchorEl } = props;
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [ready, setReady] = useState(false);
  const superpowersEnabled = useSuperpowersStore((s) => s.enabled);
  const toggleSuperpowers = useSuperpowersStore((s) => s.toggle);
  const thinkingEnabled = useThinkingDisplayStore((s) => s.enabled);
  const toggleThinkingDisplay = useThinkingDisplayStore((s) => s.toggle);

  const renderItems = buildRenderItems(commands, skills);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleClickOutside]);

  useEffect(() => {
    const el = itemRefs.current[highlightIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  // 根据锚点元素（fixed 定位坐标系）计算菜单位置，并防止超出视口
  const updatePosition = useCallback(() => {
    if (!anchorEl || !containerRef.current) return;
    const rect = anchorEl.getBoundingClientRect();
    // 使用 offsetWidth/offsetHeight 获取布局尺寸：
    // 弹出动画首帧 transform: scale(0.96) 会缩放 getBoundingClientRect 的返回值，
    // 导致菜单右边缘与触发按钮错位；offset 尺寸不受 transform 影响
    const menuWidth = containerRef.current.offsetWidth;
    const menuHeight = containerRef.current.offsetHeight;
    let left = align === "right" ? rect.right - menuWidth : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    const top = dropdownUp ? rect.top - menuHeight - 6 : rect.bottom + 6;
    setPosition({ top, left });
    setReady(true);
  }, [anchorEl, align, dropdownUp]);

  useLayoutEffect(() => {
    updatePosition();
    // 捕获阶段监听，确保内部容器滚动时也能同步位置
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    // 内容变化（如 Skills 异步加载后加入列表）导致菜单尺寸变化时重新定位，
    // 保证右边缘始终与触发按钮对齐
    let observer: ResizeObserver | null = null;
    if (containerRef.current) {
      observer = new ResizeObserver(updatePosition);
      observer.observe(containerRef.current);
    }
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  // 无锚点时（应只发生在挂载瞬间）不渲染，避免在屏幕外闪现
  if (!anchorEl) {
    return null;
  }

  return createPortal(
    <div
      ref={containerRef}
      className={`slash-menu-container ${dropdownUp ? "slash-menu-up" : "slash-menu-down"}`}
      style={{
        position: "fixed",
        top: position ? position.top : -9999,
        left: position ? position.left : -9999,
        visibility: ready ? "visible" : "hidden",
      }}
      role="listbox"
      aria-label={t("slash.menu.title")}
    >
      <div className="slash-menu-header">
        <span className="slash-menu-title">{t("slash.menu.title")}</span>
        <span className="slash-menu-hint">{t("slash.menu.hint")}</span>
      </div>

      <div className="slash-menu-list">
        {renderItems.length === 1 && renderItems[0].kind === "empty" ? (
          <div className="slash-menu-empty">{t("slash.menu.empty")}</div>
        ) : (
          renderItems.map((item, idx) => {
            if (item.kind === "divider") {
              return <div key="divider" className="slash-menu-divider" />;
            }
            if (item.kind === "skill" && item.skill) {
              const isHighlighted = idx === highlightIndex;
              const isSuperpowers = item.skill.name === BUILTIN_SUPERPOWERS_NAME;
              return (
                <div
                  key={`skill-${item.skill.name}`}
                  ref={(el) => { itemRefs.current[idx] = el; }}
                  className={`slash-menu-item ${isHighlighted ? "highlighted" : ""}`}
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (isSuperpowers) return;
                    onSkillSelect(item.skill!);
                  }}
                >
                  <div className="slash-menu-item-row">
                    <div className="slash-menu-item-name">/{item.skill.name}</div>
                    <div className="slash-menu-item-desc">{item.skill.description}</div>
                    {isSuperpowers && (
                      <button
                        className={`superpowers-toggle ${superpowersEnabled ? "superpowers-toggle-on" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleSuperpowers();
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        title={t(superpowersEnabled ? "slash.superpowers.disable" : "slash.superpowers.enable")}
                      >
                        <div className="superpowers-toggle-track">
                          <div className="superpowers-toggle-thumb" />
                        </div>
                      </button>
                    )}
                  </div>
                  {isSuperpowers && (
                    <div className="slash-menu-superpowers-hint">
                      {t(superpowersEnabled ? "slash.superpowers.hintOn" : "slash.superpowers.hintOff")}
                    </div>
                  )}
                </div>
              );
            }
            if (item.kind === "command" && item.cmd) {
              const cmd = item.cmd;
              const isHighlighted = idx === highlightIndex;
              const isDisabled = agentRunning && !cmd.allowedInAgent;
              // 开关型命令（thinking）：以滑块开关形式展示，点击本体直接切换
              const isToggleCommand = cmd.name === "thinking";
              return (
                <div
                  key={cmd.name}
                  ref={(el) => { itemRefs.current[idx] = el; }}
                  className={`slash-menu-item ${isHighlighted ? "highlighted" : ""} ${isDisabled ? "disabled" : ""}`}
                  role="option"
                  aria-selected={isHighlighted}
                  aria-disabled={isDisabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (isDisabled) return;
                    if (isToggleCommand) {
                      toggleThinkingDisplay();
                      return;
                    }
                    onSelect(cmd);
                  }}
                >
                  <div className="slash-menu-item-row">
                    <div className="slash-menu-item-name">/{cmd.name}</div>
                    <div className="slash-menu-item-desc">{t(cmd.description)}</div>
                    {isToggleCommand && (
                      <button
                        className={`superpowers-toggle ${thinkingEnabled ? "superpowers-toggle-on" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleThinkingDisplay();
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        title={t(thinkingEnabled ? "slash.thinking.disable" : "slash.thinking.enable")}
                      >
                        <div className="superpowers-toggle-track">
                          <div className="superpowers-toggle-thumb" />
                        </div>
                      </button>
                    )}
                  </div>
                  {cmd.requiresArgs && (
                    <div className="slash-menu-item-usage">{cmd.usage}</div>
                  )}
                  {isDisabled && (
                    <div className="slash-menu-item-disabled">{t("slash.menu.disabledInAgent")}</div>
                  )}
                </div>
              );
            }
            return null;
          })
        )}
      </div>

      <style>{`
        .superpowers-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-left: auto;
          padding: 2px;
          border-radius: 12px;
          cursor: pointer;
          background: transparent;
          border: none;
          transition: opacity 0.15s;
        }
        .superpowers-toggle:hover {
          opacity: 0.9;
        }
        .superpowers-toggle-track {
          width: 24px;
          height: 13px;
          border-radius: 7px;
          background: var(--color-border-strong);
          position: relative;
          transition: background 0.2s;
        }
        .superpowers-toggle-on .superpowers-toggle-track {
          background: var(--color-accent, #3b82f6);
        }
        .superpowers-toggle-thumb {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: white;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: transform 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        .superpowers-toggle-on .superpowers-toggle-thumb {
          transform: translateX(11px);
        }
        .slash-menu-superpowers-hint {
          font-size: 10px;
          color: var(--color-accent, #3b82f6);
          margin-top: 2px;
          padding-left: 2px;
        }
        .slash-menu-container {
          width: max-content;
          min-width: 320px;
          max-width: 480px;
          max-height: 200px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 10000;
          display: flex;
          flex-direction: column;
        }
        .slash-menu-container.slash-menu-up {
          animation: slash-menu-in-up 0.15s ease-out;
        }
        .slash-menu-container.slash-menu-down {
          animation: slash-menu-in-down 0.15s ease-out;
        }
        @keyframes slash-menu-in-up {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes slash-menu-in-down {
          from { opacity: 0; transform: scale(0.96) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .slash-menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 12px;
          flex-shrink: 0;
        }
        .slash-menu-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-quaternary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .slash-menu-hint {
          font-size: 10px;
          color: var(--color-text-quaternary);
          white-space: nowrap;
        }
        .slash-menu-list {
          overflow-y: auto;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 1px;
          flex: 1;
          min-height: 0;
          scrollbar-width: none;
        }
        .slash-menu-list::-webkit-scrollbar {
          display: none;
          width: 0;
        }
        .slash-menu-section-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--color-accent);
          padding: 6px 10px 2px;
          letter-spacing: 0.03em;
        }
        .slash-menu-divider {
          height: 1px;
          background: var(--color-border);
          margin: 3px 8px;
        }
        .slash-menu-empty {
          padding: 20px 16px;
          text-align: center;
          font-size: 12px;
          color: var(--color-text-quaternary);
        }
        .slash-menu-item {
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: background 0.12s;
        }
        .slash-menu-item:hover {
          background: var(--color-bg-hover);
        }
        .slash-menu-item.highlighted {
          background: var(--color-accent-bg);
        }
        .slash-menu-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .slash-menu-item.disabled:hover {
          background: transparent;
        }
        .slash-menu-item-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .slash-menu-item-name {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-primary);
          flex-shrink: 0;
        }
        .slash-menu-item-desc {
          font-size: 11px;
          color: var(--color-text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .slash-menu-item-usage {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--color-text-quaternary);
        }
        .slash-menu-item-disabled {
          font-size: 10px;
          color: var(--color-error);
          margin-top: 1px;
        }
      `}</style>
    </div>,
    document.body
  );
}
