"use client";

import { Array as Arr, DateTime, Option, Record as Rec } from "effect";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  holdOf,
  keptUpload,
  refuseHolds,
  strayFiles,
} from "@/components/ai/store/hold";
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
            refusedUploads: [],
            uploads: {},
          }),
        keepUpload: (fileId, uploadId, startedAt) =>
          set((state) => ({
            held: Rec.set(state.held, fileId, holdOf(uploadId, startedAt)),
          })),
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
        strayFiles: (fileIds, now) => strayFiles(get().held, fileIds, now),
        // A hold is removed by its upload, so a file that got a new hold keeps
        // it. Nothing changes when no listed upload is held or refused, so nobody
        // re-renders.
        forgetUploads: (uploadIds) => {
          const { held, refusedUploads } = get();
          const kept = Rec.filter(
            held,
            (hold) => !Arr.contains(uploadIds, hold.uploadId)
          );
          const stillRefused = Arr.filter(
            refusedUploads,
            (uploadId) => !Arr.contains(uploadIds, uploadId)
          );
          if (
            Rec.size(kept) < Rec.size(held) ||
            stillRefused.length < refusedUploads.length
          ) {
            set({ held: kept, refusedUploads: stillRefused });
          }
        },
        readRefusedUploads: () => get().refusedUploads,
        readUploads: (fileIds) => {
          const { held } = get();
          return Arr.getSomes(
            Arr.map(fileIds, (fileId) =>
              Option.map(Rec.get(held, fileId), (hold) => hold.uploadId)
            )
          );
        },
        // A refused upload leaves the holds at once, so no send reuses it. Its
        // place stays counted until forgetUploads records that it was given back.
        refuseUploads: (uploadIds) => {
          const { held, refusedUploads } = get();
          const refusal = refuseHolds(held, uploadIds);
          if (refusal.refused.length === 0) {
            return;
          }
          set({
            held: refusal.held,
            refusedUploads: Arr.union(refusedUploads, refusal.refused),
          });
        },
        uploadOf: (fileId, now) => keptUpload(get().held, fileId, now),
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
