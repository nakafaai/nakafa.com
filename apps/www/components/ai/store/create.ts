"use client";

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
        getModel: () => get().model,
        setActiveChatId: (activeChatId) => set({ activeChatId }),
        setChatSession: (chatSession) => set({ chatSession }),
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
