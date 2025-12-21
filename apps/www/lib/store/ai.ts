import type { ModelId } from "@repo/ai/lib/providers";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface State {
  open: boolean;
  text: string;
  model: ModelId;
  query: string;
  activeChatId: Id<"chats"> | null;
}

interface Actions {
  setOpen: (open: boolean) => void;
  setText: (text: string) => void;
  setModel: (model: ModelId) => void;
  getModel: () => ModelId;
  setQuery: (query: string) => void;
  setActiveChatId: (activeChatId: Id<"chats"> | null) => void;
}

export type AiStore = State & Actions;

const initialState: State = {
  open: false,
  text: "",
  model: "xai/grok-4.1-fast-reasoning",
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
