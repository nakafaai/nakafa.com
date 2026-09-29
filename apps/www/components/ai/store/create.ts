"use client";

import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { initialState } from "@/components/ai/store/state";
import type { AiStore } from "@/components/ai/store/types";

/** Creates one scoped Zustand store for Nina UI state. */
export function createAiStore() {
  return createStore<AiStore>()(
    persist(
      immer((set, get) => ({
        ...initialState,
        addChatDraft: (key) =>
          set((state) => {
            state.chatDrafts.unshift(key);
          }),
        getModel: () => get().model,
        // A pending ask owns the sheet, so a second one is refused atomically.
        openAsk: (ask) => {
          if (get().ask) {
            return false;
          }
          set({ activeChatId: null, ask, open: true, sheetActivated: true });
          return true;
        },
        removeChatDraft: (key) =>
          set((state) => {
            state.chatDrafts = state.chatDrafts.filter(
              (draft) => draft !== key
            );
          }),
        // One update hands the sheet from the pending prompt to its admitted chat.
        resolveAsk: (id, chatId) =>
          set((state) => {
            if (state.ask?.id !== id) {
              return;
            }
            state.ask = null;
            if (chatId) {
              state.activeChatId = chatId;
            }
          }),
        resolveChatDraft: (key, receipt) =>
          set((state) => {
            if (!state.chatDrafts.includes(key)) {
              return;
            }
            // Convex resolves mutations after subscribed queries include the write.
            state.chatDrafts = state.chatDrafts.filter(
              (draft) => draft !== key
            );
            state.openingChat = {
              receipt,
              prompt: receipt.prompt,
              submittedAt: Date.now(),
            };
          }),
        setActiveChatId: (activeChatId) => set({ activeChatId }),
        setContextTitle: (contextTitle) => set({ contextTitle }),
        setModel: (model) => set({ model }),
        setOpeningChat: (openingChat) => set({ openingChat }),
        setOpen: (open) =>
          set((state) => ({
            open,
            sheetActivated: state.sheetActivated || open,
          })),
        setText: (text) =>
          set((state) => ({
            text: typeof text === "function" ? text(state.text) : text,
          })),
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
