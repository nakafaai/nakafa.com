"use client";

import { MODEL_IDS } from "@repo/ai/config/models";
import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { initialState } from "@/components/ai/store/state";
import type { AiStore } from "@/components/ai/store/types";

/** Creates one scoped Zustand store for Nina UI state. */
export const createAiStore = () =>
  createStore<AiStore>()(
    persist(
      immer((set, get) => ({
        ...initialState,
        clearPendingQuery: () =>
          set({
            pendingQuery: "",
            pendingQueryChatId: null,
            pendingQueryOwner: null,
          }),
        getModel: () => {
          const current = get().model;
          if (MODEL_IDS.includes(current)) {
            return current;
          }
          return initialState.model;
        },
        queuePendingQuery: ({ chatId, owner, query }) =>
          set({
            pendingQuery: query,
            pendingQueryChatId: chatId,
            pendingQueryOwner: owner,
          }),
        setActiveChatId: (activeChatId) => set({ activeChatId }),
        setContextTitle: (contextTitle) => set({ contextTitle }),
        setModel: (model) => set({ model }),
        setOpen: (open) => set({ open }),
        setText: (text) => set({ text }),
      })),
      {
        name: "nakafa-ai",
        partialize: (state) => ({ activeChatId: state.activeChatId }),
        version: 1,
      }
    )
  );

export type AiStoreApi = ReturnType<typeof createAiStore>;
