import type { ModelId } from "@repo/ai/lib/providers";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { routing } from "@repo/internationalization/src/routing";
import type { Locale } from "next-intl";
import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type State = {
  open: boolean;
  text: string;
  model: ModelId;
  locale: Locale;
  slug: string;
  query: string;
  activeChatId: Id<"chats"> | null;
};

type Actions = {
  setOpen: (open: boolean) => void;
  setText: (text: string) => void;
  setModel: (model: ModelId) => void;
  getModel: () => ModelId;
  getLocale: () => Locale;
  getSlug: () => string;
  setQuery: (query: string) => void;
  setActiveChatId: (activeChatId: Id<"chats"> | null) => void;
};

export type AiStore = State & Actions;

const initialState: State = {
  open: false,
  text: "",
  model: "grok-4-fast-reasoning",
  locale: routing.defaultLocale,
  slug: "",
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
        getLocale: () => get().locale,
        getSlug: () => get().slug,
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
