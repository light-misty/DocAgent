import { useEffect, useRef, useState } from "react";

/**
 * 流式文本平滑显示 hook
 *
 * 问题背景：LLM 流式输出时，每个 SSE delta 都会触发一次状态更新，
 * React 18 自动批处理与 Rust 侧 mpsc 积压会导致内容"一块一块"或"瞬间全部"显示。
 *
 * 方案：以完整内容为权威数据源，通过 requestAnimationFrame 每帧最多推进
 * charsPerFrame 个字符。无论事件如何积压，视觉上始终保持平滑增长，
 * 积压时自动追赶（不丢内容）；流式结束后立即显示全文。
 *
 * @param fullText 权威完整内容（来自 store 的完整累积内容）
 * @param isStreaming 是否处于流式状态
 * @param charsPerFrame 每帧最多推进的字符数（默认 260，约 1.5 万字符/秒）
 */
export function useSmoothStreamingText(
  fullText: string,
  isStreaming: boolean,
  charsPerFrame = 260
): string {
  const [displayText, setDisplayText] = useState(() =>
    isStreaming ? "" : fullText
  );
  // 显示进度（已显示的字符数），用 ref 避免 rAF 循环中的 stale closure
  const progressRef = useRef(isStreaming ? 0 : fullText.length);
  // 最新完整内容，供 rAF 循环读取
  const fullTextRef = useRef(fullText);
  const rafIdRef = useRef(0);

  useEffect(() => {
    // 同步最新完整内容
    fullTextRef.current = fullText;
    // 流式结束：直接显示全文，停止推进循环
    if (!isStreaming) {
      progressRef.current = fullText.length;
      setDisplayText(fullText);
      cancelAnimationFrame(rafIdRef.current);
      return;
    }

    // 流式进行中：每帧最多推进 charsPerFrame 个字符
    cancelAnimationFrame(rafIdRef.current);
    const tick = () => {
      const target = fullTextRef.current;
      const next = Math.min(target.length, progressRef.current + charsPerFrame);
      progressRef.current = next;
      setDisplayText(target.slice(0, next));
      // 未追上最新内容时继续推进，追平后等待下一轮内容到达
      if (next < target.length) {
        rafIdRef.current = requestAnimationFrame(tick);
      }
    };
    rafIdRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafIdRef.current);
  }, [fullText, isStreaming, charsPerFrame]);

  return displayText;
}
