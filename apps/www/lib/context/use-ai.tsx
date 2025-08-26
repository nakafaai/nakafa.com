"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { useLocale } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type AiStore, createAiStore } from "@/lib/store/ai";

type AiStoreApi = ReturnType<typeof createAiStore>;

export const AiContext = createContext<AiStoreApi | null>(null);

export function AiContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const storeRef = useRef<AiStoreApi>(undefined);

  if (!storeRef.current) {
    storeRef.current = createAiStore();
  }

  useEffect(() => {
    if (storeRef.current) {
      storeRef.current.setState({
        locale,
        slug: pathname,
      });
    }
  }, [locale, pathname]);

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
