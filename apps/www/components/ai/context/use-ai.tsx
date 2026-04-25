"use client";

import { type ReactNode, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type AiStoreApi, createAiStore } from "@/components/ai/store/create";
import type { AiStore } from "@/components/ai/store/types";

const AiContext = createContext<AiStoreApi | null>(null);

/** Provides the Nina store to AI components. */
export function AiContextProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createAiStore());

  return <AiContext.Provider value={store}>{children}</AiContext.Provider>;
}

/** Reads the Nina store instance from context. */
function useAiContext() {
  const context = useContextSelector(AiContext, (value) => value);
  if (!context) {
    throw new Error("useAi must be used within AiContextProvider");
  }
  return context;
}

/** Reads one selected slice of Nina UI state. */
export function useAi<T>(selector: (state: AiStore) => T) {
  const store = useAiContext();
  return useStore(store, useShallow(selector));
}
