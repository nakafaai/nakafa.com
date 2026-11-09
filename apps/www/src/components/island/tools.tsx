import { useRequired } from "@repo/design-system/hooks/required";
import { createContext, type ReactNode, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createToolStore, type ToolStore } from "@/lib/island/tools";

const ToolsContext = createContext<ToolStore | null>(null);

/** Gives one island frame its own build tools. */
export function ToolsProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createToolStore);
  return <ToolsContext value={store}>{children}</ToolsContext>;
}

/** The store of the surrounding frame's build tools, for event handlers that read it as they run. */
export function useToolStore() {
  return useRequired(ToolsContext, "useToolStore");
}

/** Reads part of the surrounding frame's build tools and follows its changes. */
export function useTools<T>(
  selector: (state: ReturnType<ToolStore["getState"]>) => T
) {
  return useStore(useToolStore(), useShallow(selector));
}
