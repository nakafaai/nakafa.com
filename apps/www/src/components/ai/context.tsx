"use client";

import { useRequired } from "@repo/design-system/hooks/required";
import { Option } from "effect";
import { createContext, type ReactNode, useEffect, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type AiStoreApi, createAiStore } from "@/components/ai/store/create";
import type { AiStore } from "@/components/ai/store/types";
import { useAuthSession } from "@/components/auth/session";
import { useLiveSession } from "@/components/providers/live";
import { hasSignedInHint } from "@/lib/auth/hint";

const AiContext = createContext<AiStoreApi | null>(null);

/**
 * Provides the Nina store to AI components. The store learns who owns its chat and
 * draft only once the page knows its session. A page renders signed out and starts
 * its session after React takes it over, so until it has looked, a page with the
 * signed-in hint still shows the state it was rendered with. Taking that state for
 * a visitor would make the learner's answer read as another owner, and the store
 * would forget the chat the learner had open.
 */
export function AiContextProvider({ children }: { children: ReactNode }) {
  const ownerId = useAuthSession((session) =>
    session.isPending || session.hasError ? undefined : session.userId
  );
  const looked = useLiveSession(
    (state) => Option.isSome(state.client) || state.hasError
  );
  const [store] = useState(createAiStore);

  // The session is an external source, so its answer reaches the store here, once for each answer.
  useEffect(() => {
    const known = looked || !hasSignedInHint(document.cookie);
    store.getState().adoptDraftOwner(known ? ownerId : undefined);
  }, [looked, ownerId, store]);

  return <AiContext value={store}>{children}</AiContext>;
}

/** Reads the Nina store instance from context. */
function useAiContext() {
  return useRequired(AiContext, "useAiContext");
}

/** Reads one selected slice of Nina UI state. */
export function useAi<T>(selector: (state: AiStore) => T) {
  const store = useAiContext();
  return useStore(store, useShallow(selector));
}
