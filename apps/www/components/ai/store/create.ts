"use client";

import { Effect } from "effect";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { saveAiDraftText } from "@/components/ai/store/draft";
import { initialState } from "@/components/ai/store/state";
import type { AiStore } from "@/components/ai/store/types";

type ReadDraftOwnerId = () => string | null | undefined;

/** Creates one scoped Zustand store for Nina UI state. */
export function createAiStore(readDraftOwnerId: ReadDraftOwnerId) {
  return createStore<AiStore>()(
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
          Effect.runSync(saveAiDraftText(text, readDraftOwnerId()));
        },
      })),
      {
        name: "nakafa-ai",
        partialize: (state) => ({ activeChatId: state.activeChatId }),
        storage: createJSONStorage(() => localStorage),
        version: 1,
      }
    )
  );
}

export type AiStoreApi = ReturnType<typeof createAiStore>;
