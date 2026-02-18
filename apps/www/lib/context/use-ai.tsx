"use client";

import { type ReactNode, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type AiStore, createAiStore } from "@/lib/store/ai";

type AiStoreApi = ReturnType<typeof createAiStore>;

export const AiContext = createContext<AiStoreApi | null>(null);

export function AiContextProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createAiStore());

  return <AiContext.Provider value={store}>{children}</AiContext.Provider>;
}

function useAiContext() {
  const ctx = useContextSelector(AiContext, (context) => context);
  if (!ctx) {
    throw new Error("useAi must be used within a AiContextProvider");
  }
  return ctx;
}

export function useAi<T>(selector: (state: AiStore) => T) {
  const store = useAiContext();
  return useStore(store, useShallow(selector));
}
