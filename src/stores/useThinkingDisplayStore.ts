import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThinkingDisplayState {
  /** 开启：遵循默认展示效果（思考过程标签自动展开，结束后自动折叠）；关闭：始终折叠，可手动展开 */
  enabled: boolean;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
}

export const useThinkingDisplayStore = create<ThinkingDisplayState>()(
  persist(
    (set) => ({
      enabled: true,
      toggle: () => set((state) => ({ enabled: !state.enabled })),
      setEnabled: (enabled: boolean) => set({ enabled }),
    }),
    {
      name: "samoyed-work-thinking-display",
    },
  ),
);
