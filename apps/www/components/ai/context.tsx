"use client";

import { Effect } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useRef,
  useState,
} from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type AiStoreApi, createAiStore } from "@/components/ai/store/create";
import {
  resolveAiDraftText,
  resolveAiOwnerChange,
  saveAiDraftText,
} from "@/components/ai/store/draft";
import type { AiStore } from "@/components/ai/store/types";
import { useAuthSession } from "@/components/auth/session";

const AiContext = createContext<AiStoreApi | null>(null);

/** Provides the Nina store to AI components. */
export function AiContextProvider({ children }: { children: ReactNode }) {
  const ownerId = useAuthSession((session) =>
    session.isPending || session.hasError ? undefined : session.userId
  );
  const activeDraftOwnerIdRef = useRef<string | null | undefined>(undefined);
  const pendingDraftRef = useRef({
    changed: false,
    text: "",
  });
  const previousDraftOwnerIdRef = useRef<string | null | undefined>(undefined);
  const [store] = useState(createAiStore);

  useEffect(
    () =>
      store.subscribe((state, previousState) => {
        if (state.text === previousState.text) {
          return;
        }

        const activeOwnerId = activeDraftOwnerIdRef.current;
        if (activeOwnerId === undefined) {
          pendingDraftRef.current = {
            changed: true,
            text: state.text,
          };
          return;
        }

        Effect.runSync(saveAiDraftText(state.text, activeOwnerId));
      }),
    [store]
  );

  useEffect(() => {
    if (ownerId === undefined) {
      activeDraftOwnerIdRef.current = undefined;
      return;
    }

    const { mustResetDraft, ownerChanged } = resolveAiOwnerChange(
      previousDraftOwnerIdRef.current,
      ownerId
    );
    if (ownerChanged) {
      // Nothing the store holds for the previous owner is for this one. A
      // pending ask must not open that owner's chat in this session. The
      // uploads that owner held are forgotten, not given back: the server
      // refuses to release another learner's upload, so their expiry frees them.
      store.getState().endSession();
    }
    if (mustResetDraft) {
      activeDraftOwnerIdRef.current = undefined;
      pendingDraftRef.current = {
        changed: false,
        text: "",
      };
      if (store.getState().text.length > 0) {
        store.setState({ text: "" });
      }
      // The files of the draft go with its text, so every composer starts over.
      store.getState().resetComposers();
    }

    const pendingDraft = pendingDraftRef.current;
    const draftText = Effect.runSync(
      resolveAiDraftText({
        ownerId,
        pendingText: pendingDraft.text,
        pendingTextChanged: !mustResetDraft && pendingDraft.changed,
      })
    );
    if (draftText !== null && draftText !== store.getState().text) {
      store.setState({ text: draftText });
    }

    activeDraftOwnerIdRef.current = ownerId;
    pendingDraftRef.current = {
      changed: false,
      text: "",
    };
    previousDraftOwnerIdRef.current = ownerId;
  }, [ownerId, store]);

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
