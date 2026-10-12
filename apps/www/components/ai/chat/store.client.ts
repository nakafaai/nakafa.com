"use client";

import type { Ref } from "@confect/core";
import type nina from "@repo/backend/confect/_generated/refs/nina";
import { createContext, use } from "react";
import { createStore, useStore } from "zustand";
import type {
  NinaConnectionError,
  NinaFailure,
} from "@/components/ai/feedback";

/**
 * What the actions of one conversation write: whether the learner is deleting
 * the chat, and the failures of what they asked of it. Everything else the
 * conversation holds is read from the server or follows a transition, so it
 * lives in the chat context.
 */
interface ChatStore {
  /** Stops reading the chat, because the learner is deleting it. */
  leave: () => void;
  /**
   * Whether the learner is deleting the chat. Once the server has deleted it,
   * every read of it fails, so the page stops reading it at the press and
   * shows no chat until it moves on, or until the server refuses the delete.
   */
  leaving: boolean;
  setStopFailure: (stopFailure: ChatStore["stopFailure"]) => void;
  setSubmissionFailure: (
    submissionFailure: ChatStore["submissionFailure"]
  ) => void;
  /** Reads the chat again, after a delete the server refused. */
  stay: () => void;
  /** The stop the server did not take, and the turn the learner pressed it for. */
  stopFailure: {
    readonly failure:
      | Ref.Error<typeof nina.lifecycle.cancel>
      | NinaConnectionError;
    readonly order: number | undefined;
  } | null;
  /** The refusal of the latest message or retry, until the next one starts. */
  submissionFailure: NinaFailure | null;
}

/** Creates the store of one conversation, which lives and ends with its provider. */
export function createChatStore() {
  return createStore<ChatStore>()((set) => ({
    leave: () => set({ leaving: true }),
    leaving: false,
    setStopFailure: (stopFailure) => set({ stopFailure }),
    setSubmissionFailure: (submissionFailure) => set({ submissionFailure }),
    stay: () => set({ leaving: false }),
    stopFailure: null,
    submissionFailure: null,
  }));
}

export type ChatStoreApi = ReturnType<typeof createChatStore>;

export const ChatStoreContext = createContext<ChatStoreApi | null>(null);

/** Reads one selected slice of the conversation's own state and actions. */
export function useChatStore<T>(selector: (state: ChatStore) => T) {
  const store = use(ChatStoreContext);
  if (!store) {
    throw new Error("useChatStore must be used within ChatProvider");
  }
  return useStore(store, selector);
}
