"use client";

import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type AiStoreApi, createAiStore } from "@/components/ai/store/create";
import type { AiStore } from "@/components/ai/store/types";
import { useAuthSession } from "@/components/auth/session";

const AiContext = createContext<AiStoreApi | null>(null);

/** Provides the Nina store to AI components. */
export function AiContextProvider({ children }: { children: ReactNode }) {
  const ownerId = useAuthSession((session) =>
    session.isPending || session.hasError ? undefined : session.userId
  );
  const [store] = useState(createAiStore);

  // The session is an external source, so its answer reaches the store here, once for each answer.
  useEffect(() => store.getState().adoptDraftOwner(ownerId), [ownerId, store]);

  return <AiContext value={store}>{children}</AiContext>;
}

/** Reads the Nina store instance from context. */
function useAiContext() {
  const context = use(AiContext);
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
