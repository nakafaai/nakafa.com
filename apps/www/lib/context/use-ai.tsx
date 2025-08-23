"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type AiStore, createAiStore } from "@/lib/store/ai";

type AiStoreApi = ReturnType<typeof createAiStore>;

export const AiContext = createContext<AiStoreApi | null>(null);

export function AiContextProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AiStoreApi>(undefined);

  if (!storeRef.current) {
    storeRef.current = createAiStore();
  }

  return (
    <AiContext.Provider value={storeRef.current}>{children}</AiContext.Provider>
  );
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

export function useAiHydrated() {
  const store = useAiContext();

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unSubFinish = store.persist.onFinishHydration(() =>
      setHydrated(true)
    );

    setHydrated(store.persist.hasHydrated());

    return () => {
      unSubFinish();
    };
  }, [store]);

  return hydrated;
}
