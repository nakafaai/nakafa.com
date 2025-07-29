import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type State = {
  open: boolean;
};

type Actions = {
  setOpen: (open: boolean) => void;
};

export type AiStore = State & Actions;

const initialState: State = {
  open: false,
};

export const createAiStore = () => {
  return createStore<AiStore>()(
    persist(
      immer((set) => ({
        ...initialState,
        setOpen: (open) => set({ open }),
      })),
      {
        storage: createJSONStorage(() => localStorage),
        name: "ai",
      }
    )
  );
};
