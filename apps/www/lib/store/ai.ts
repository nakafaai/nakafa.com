import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type State = {
  open: boolean;
  text: string;
};

type Actions = {
  setOpen: (open: boolean) => void;
  setText: (text: string) => void;
};

export type AiStore = State & Actions;

const initialState: State = {
  open: false,
  text: "",
};

export const createAiStore = () => {
  return createStore<AiStore>()(
    persist(
      immer((set) => ({
        ...initialState,

        setOpen: (open) => set({ open }),
        setText: (text) => set({ text }),
      })),
      {
        storage: createJSONStorage(() => localStorage),
        name: "ai",
      }
    )
  );
};
