import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { WorkflowNode, ThinkingNodeData } from "../../types";
import { useThinkingDisplayStore } from "../../stores/useThinkingDisplayStore";
import { Icon } from "../common/Icon";
import { useSmoothStreamingText } from "../../hooks/useSmoothStreamingText";

interface ThinkingNodeProps {
  node: WorkflowNode<"thinking">;
}

export function ThinkingNode({ node }: ThinkingNodeProps) {
  const { t } = useTranslation();
  const data = node.data as ThinkingNodeData;
  const isStreaming = data.isStreaming || node.status === "running";
  // 流式节点启用平滑显示（逐帧推进，避免内容跳块/瞬间全显）
  const displayContent = useSmoothStreamingText(data.content, isStreaming);
  // 思考过程自动展开开关：开启时遵循默认展示效果，关闭时始终折叠（可手动展开）
  const autoExpandEnabled = useThinkingDisplayStore((s) => s.enabled);
  const [expanded, setExpanded] = useState(autoExpandEnabled && isStreaming);

  useEffect(() => {
    if (!autoExpandEnabled) {
      // 关闭模式：始终折叠，用户可手动展开/折叠
      setExpanded(false);
      return;
    }
    if (isStreaming) {
      setExpanded(true);
    } else if (node.status === "completed") {
      setExpanded(false);
    }
  }, [isStreaming, node.status, autoExpandEnabled]);

  return (
    <div className="wf-node">
      <div className="wf-thinking-block">
        <div
          className="wf-thinking-toggle"
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span>{t("workflow.thinking")}</span>
          <Icon
            name={expanded ? "chevron-down" : "chevron-right"}
            size={12}
          />
        </div>

        {expanded && (
          <div className="wf-thinking-content">
            {displayContent.split("\n\n").filter((p) => p.trim()).map((paragraph, index) => (
              <p key={index} className="wf-thinking-paragraph">
                {paragraph.trim()}
              </p>
            ))}

          </div>
        )}
      </div>
    </div>
  );
}
