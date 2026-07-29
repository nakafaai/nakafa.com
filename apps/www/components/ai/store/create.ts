"use client";

import { Effect } from "effect";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { readAiDraftText, saveAiDraftText } from "@/components/ai/store/draft";
import { initialState } from "@/components/ai/store/state";
import type { AiStore } from "@/components/ai/store/types";

/** Restores the saved Nina draft after the persisted store rehydrates. */
function restoreDraftText(state: AiStore | undefined) {
  const text = Effect.runSync(readAiDraftText());
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
          set({ text });
          Effect.runSync(saveAiDraftText(text));
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
