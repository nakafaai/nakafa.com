import type { ModelId } from "@repo/ai/config/vercel";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface State {
  activeChatId: Id<"chats"> | null;
  model: ModelId;
  open: boolean;
  query: string;
  text: string;
}

interface Actions {
  getModel: () => ModelId;
  setActiveChatId: (activeChatId: Id<"chats"> | null) => void;
  setModel: (model: ModelId) => void;
  setOpen: (open: boolean) => void;
  setQuery: (query: string) => void;
  setText: (text: string) => void;
}

export type AiStore = State & Actions;

const initialState: State = {
  open: false,
  text: "",
  model: "kimi-k2.5",
  query: "",
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
        getModel: () => get().model,
        setQuery: (query) => set({ query }),
        setActiveChatId: (activeChatId) => set({ activeChatId }),
      })),
      {
        name: "nakafa-ai",
        partialize: (state) => ({ activeChatId: state.activeChatId }),
        version: 1,
      }
    )
  );
