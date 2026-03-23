import type { ModelId } from "@repo/ai/config/models";
import { MODEL_IDS } from "@repo/ai/config/models";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface State {
  activeChatId: Id<"chats"> | null;
  model: ModelId;
  open: boolean;
  pendingQuery: string;
  pendingQueryChatId: Id<"chats"> | null;
  pendingQueryOwner: "page" | "sheet" | null;
  text: string;
}

interface Actions {
  clearPendingQuery: () => void;
  getModel: () => ModelId;
  queuePendingQuery: (args: {
    chatId: Id<"chats">;
    owner: "page" | "sheet";
    query: string;
  }) => void;
  setActiveChatId: (activeChatId: Id<"chats"> | null) => void;
  setModel: (model: ModelId) => void;
  setOpen: (open: boolean) => void;
  setText: (text: string) => void;
}

export type AiStore = State & Actions;

const initialState: State = {
  open: false,
  text: "",
  model: "kimi-k2.5",
  pendingQuery: "",
  pendingQueryChatId: null,
  pendingQueryOwner: null,
  activeChatId: null,
};

export const createAiStore = () =>
  createStore<AiStore>()(
    persist(
      immer((set, get) => ({
        ...initialState,

        setOpen: (open) => set({ open }),
        setText: (text) => set({ text }),
        setModel: (model) => set({ model }),
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
      })),
      {
        name: "nakafa-ai",
        partialize: (state) => ({ activeChatId: state.activeChatId }),
        version: 1,
      }
    )
  );
