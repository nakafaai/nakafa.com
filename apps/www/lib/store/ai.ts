import { routing } from "@repo/internationalization/src/routing";
import type { Locale } from "next-intl";
import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";

type State = {
  open: boolean;
  text: string;
  model: "standard" | "pro";
  locale: Locale;
  slug: string;
};

type Actions = {
  setOpen: (open: boolean) => void;
  setText: (text: string) => void;
  setModel: (model: "standard" | "pro") => void;
  getModel: () => "standard" | "pro";
  getLocale: () => Locale;
  getSlug: () => string;
};

export type AiStore = State & Actions;

const initialState: State = {
  open: false,
  text: "",
  model: "standard",
  locale: routing.defaultLocale,
  slug: "",
};

export const createAiStore = () => {
  return createStore<AiStore>()(
    immer((set, get) => ({
      ...initialState,

      setOpen: (open) => set({ open }),
      setText: (text) => set({ text }),
      setModel: (model) => set({ model }),
      getModel: () => get().model,
      getLocale: () => get().locale,
      getSlug: () => get().slug,
    }))
  );
};
