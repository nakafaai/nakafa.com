import type { ModelId } from "@repo/ai/lib/providers";
import { routing } from "@repo/internationalization/src/routing";
import type { Locale } from "next-intl";
import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";

type State = {
  open: boolean;
  text: string;
  model: ModelId;
  locale: Locale;
  slug: string;
};

type Actions = {
  setOpen: (open: boolean) => void;
  setText: (text: string) => void;
  setModel: (model: ModelId) => void;
  getModel: () => ModelId;
  getLocale: () => Locale;
  getSlug: () => string;
};

export type AiStore = State & Actions;

const initialState: State = {
  open: false,
  text: "",
  model: "sonoma-sky", // TODO: NEED TO CHANGE WHEN IT'S NOT FREE ANYMORE
  locale: routing.defaultLocale,
  slug: "",
};

export const createAiStore = () =>
  createStore<AiStore>()(
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
