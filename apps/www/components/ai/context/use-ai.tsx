"use client";

import { Effect } from "effect";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type AiStoreApi, createAiStore } from "@/components/ai/store/create";
import { readAiDraftText, saveAiDraftText } from "@/components/ai/store/draft";
import type { AiStore } from "@/components/ai/store/types";
import { authClient } from "@/lib/auth/client";

const AiContext = createContext<AiStoreApi | null>(null);

/** Provides the Nina store to AI components. */
export function AiContextProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const draftOwnerIdRef = useRef<string | null | undefined>(undefined);
  const previousDraftOwnerIdRef = useRef<string | null | undefined>(undefined);

  /** Reads the latest resolved account identity without recreating the store. */
  function readDraftOwnerId() {
    return draftOwnerIdRef.current;
  }

  const [store] = useState(() => createAiStore(readDraftOwnerId));
  let ownerId: string | null | undefined;
  if (!isPending) {
    ownerId = session?.user.isAnonymous ? null : (session?.user.id ?? null);
  }

  useEffect(() => {
    draftOwnerIdRef.current = ownerId;
  }, [ownerId]);

  useEffect(() => {
    if (ownerId === undefined) {
      return;
    }

    const previousOwnerId = previousDraftOwnerIdRef.current;
    const pendingText =
      previousOwnerId === undefined ? store.getState().text : "";
    if (previousOwnerId !== undefined && previousOwnerId !== ownerId) {
      store.setState({ text: "" });
    }

    const storedText = Effect.runSync(readAiDraftText(ownerId));
    if (storedText) {
      store.setState({ text: storedText });
    } else if (pendingText) {
      Effect.runSync(saveAiDraftText(pendingText, ownerId));
    }

    previousDraftOwnerIdRef.current = ownerId;
  }, [ownerId, store]);

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
