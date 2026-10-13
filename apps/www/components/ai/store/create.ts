"use client";

import { Array as Arr, DateTime, Record as Rec } from "effect";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { initialState } from "@/components/ai/store/state";
import type { AiStore } from "@/components/ai/store/types";

/** The browser storage key under which the store remembers the chat the sheet has open. */
export const AI_STORAGE_KEY = "nakafa-ai";

/** Creates one scoped Zustand store for Nina UI state. */
export function createAiStore() {
  return createStore<AiStore>()(
    persist(
      (set, get) => ({
        ...initialState,
        addChatDraft: (key) =>
          set((state) => ({
            chatDrafts: Arr.prepend(state.chatDrafts, key),
          })),
        clearUpload: (fileId) =>
          set((state) => ({ uploads: Rec.remove(state.uploads, fileId) })),
        // The text of the draft is not cleared here: a visitor who signs in
        // keeps what they wrote, and the caller decides that.
        endSession: () =>
          set({
            activeChatId: null,
            ask: null,
            chatDrafts: [],
            held: {},
            openingChat: null,
            uploads: {},
          }),
        keepUpload: (fileId, uploadId) =>
          set((state) => ({ held: Rec.set(state.held, fileId, uploadId) })),
        markUpload: (fileId, status) =>
          set((state) => ({ uploads: Rec.set(state.uploads, fileId, status) })),
        // One new-chat admission at a time: a pending ask or composer draft
        // owns it, so a second one is refused atomically.
        openAsk: (ask) => {
          const state = get();
          if (state.ask || state.chatDrafts.length > 0) {
            return false;
          }
          set({ activeChatId: null, ask, open: true, warmed: true });
          return true;
        },
        removeChatDraft: (key) =>
          set((state) => {
            if (!Arr.contains(state.chatDrafts, key)) {
              return state;
            }
            return {
              chatDrafts: Arr.filter(
                state.chatDrafts,
                (draft) => draft !== key
              ),
            };
          }),
        resetComposers: () =>
          set((state) => ({ composerKey: state.composerKey + 1 })),
        // The admitted chat opens only while the sheet still shows its prompt,
        // so a conversation the learner picked meanwhile stays open.
        resolveAsk: (id, chatId) =>
          set((state) => {
            if (state.ask?.id !== id) {
              return state;
            }
            return {
              activeChatId:
                chatId && state.activeChatId === null
                  ? chatId
                  : state.activeChatId,
              ask: null,
            };
          }),
        resolveChatDraft: (key, receipt) =>
          set((state) => {
            if (!Arr.contains(state.chatDrafts, key)) {
              return state;
            }
            // Convex resolves mutations after subscribed queries include the write.
            return {
              chatDrafts: Arr.filter(
                state.chatDrafts,
                (draft) => draft !== key
              ),
              openingChat: {
                receipt,
                prompt: receipt.prompt,
                submittedAt: DateTime.toEpochMillis(DateTime.nowUnsafe()),
              },
            };
          }),
        setActiveChatId: (activeChatId) => set({ activeChatId }),
        setContextTitle: (contextTitle) => set({ contextTitle }),
        setOpeningChat: (openingChat) => set({ openingChat }),
        // An open sheet shows its body, so opening also warms it.
        setOpen: (open) =>
          set((state) => ({ open, warmed: state.warmed || open })),
        setText: (text) =>
          set((state) => ({
            text: typeof text === "function" ? text(state.text) : text,
          })),
        // A file that holds no upload changes nothing, so nobody re-renders.
        takeUploads: (fileIds) => {
          const { held } = get();
          const taken = Arr.getSomes(
            Arr.map(fileIds, (fileId) => Rec.get(held, fileId))
          );
          if (Arr.isReadonlyArrayNonEmpty(taken)) {
            set({
              held: Arr.reduce(fileIds, held, (rest, fileId) =>
                Rec.remove(rest, fileId)
              ),
            });
          }
          return taken;
        },
        uploadOf: (fileId) => Rec.get(get().held, fileId),
        // The reader showed intent: the sheet's body renders hidden from now
        // on, so the press that opens it usually finds it ready.
        warm: () => set({ warmed: true }),
      }),
      {
        name: AI_STORAGE_KEY,
        partialize: (state) => ({ activeChatId: state.activeChatId }),
        storage: createJSONStorage(() => localStorage),
        version: 1,
      }
    )
  );
}

export type AiStoreApi = ReturnType<typeof createAiStore>;
