"use client";

import { Effect } from "effect";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type AiStoreApi, createAiStore } from "@/components/ai/store/create";
import {
  resolveAiDraftText,
  saveAiDraftText,
} from "@/components/ai/store/draft";
import type { AiStore } from "@/components/ai/store/types";
import { authClient } from "@/lib/auth/client";

const AiContext = createContext<AiStoreApi | null>(null);

/** Provides the Nina store to AI components. */
export function AiContextProvider({ children }: { children: ReactNode }) {
  const { data: session, error, isPending } = authClient.useSession();
  const previousDraftOwnerIdRef = useRef<string | null | undefined>(undefined);
  const [store] = useState(createAiStore);
  let ownerId: string | null | undefined;
  if (!(isPending || error)) {
    ownerId = session?.user.isAnonymous ? null : (session?.user.id ?? null);
  }

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

    const draftText = Effect.runSync(resolveAiDraftText(pendingText, ownerId));
    if (draftText && draftText !== store.getState().text) {
      store.setState({ text: draftText });
    }

    previousDraftOwnerIdRef.current = ownerId;

    return store.subscribe((state, previousState) => {
      if (state.text !== previousState.text) {
        Effect.runSync(saveAiDraftText(state.text, ownerId));
      }
    });
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
