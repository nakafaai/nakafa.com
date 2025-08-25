import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";

type State = {
  open: boolean;
  text: string;
  model: "standard" | "pro";
};

type Actions = {
  setOpen: (open: boolean) => void;
  setText: (text: string) => void;
  setModel: (model: "standard" | "pro") => void;
  getModel: () => "standard" | "pro";
};

export type AiStore = State & Actions;

const initialState: State = {
  open: false,
  text: "",
  model: "standard",
};

export const createAiStore = () => {
  return createStore<AiStore>()(
    immer((set, get) => ({
      ...initialState,

      setOpen: (open) => set({ open }),
      setText: (text) => set({ text }),
      setModel: (model) => set({ model }),
      getModel: () => get().model,
    }))
  );
};
