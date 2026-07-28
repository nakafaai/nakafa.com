"use client";

import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { initialState } from "@/components/ai/store/state";
import type { AiStore } from "@/components/ai/store/types";

const AI_DRAFT_STORAGE_KEY = "nakafa-ai-draft";

function saveDraftText(text: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (text.length === 0) {
    window.sessionStorage.removeItem(AI_DRAFT_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(AI_DRAFT_STORAGE_KEY, text);
}

function restoreDraftText(state: AiStore | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  const text = window.sessionStorage.getItem(AI_DRAFT_STORAGE_KEY);
  if (text) {
    state?.setText(text);
  }
}

/** Creates one scoped Zustand store for Nina UI state. */
export const createAiStore = () =>
  createStore<AiStore>()(
    persist(
      immer((set, get) => ({
        ...initialState,
        getModel: () => get().model,
        setActiveChatId: (activeChatId) => set({ activeChatId }),
        setChatSession: (chatSession) => set({ chatSession }),
        setContextTitle: (contextTitle) => set({ contextTitle }),
        setModel: (model) => set({ model }),
        setOpen: (open) => set({ open }),
        setText: (text) => {
          saveDraftText(text);
          set({ text });
        },
      })),
      {
        name: "nakafa-ai",
        onRehydrateStorage: () => restoreDraftText,
        partialize: (state) => ({ activeChatId: state.activeChatId }),
        storage: createJSONStorage(() => localStorage),
        version: 1,
      }
    )
  );

export type AiStoreApi = ReturnType<typeof createAiStore>;
