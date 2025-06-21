import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type State = {
  query: string;
  open: boolean;
};

type Actions = {
  setQuery: (query: string) => void;
  setOpen: (open: boolean) => void;
};

export type SearchStore = State & Actions;

const initialState: State = {
  query: "",
  open: false,
};

export const createSearchStore = () => {
  return createStore<SearchStore>()(
    persist(
      immer((set) => ({
        ...initialState,

        setQuery: (query: string) => {
          set((state) => {
            state.query = query;
          });
        },
        setOpen: (open: boolean) => {
          set((state) => {
            state.open = open;
          });
        },
      })),
      {
        name: "nakafa-search",
        storage: createJSONStorage(() => sessionStorage),
      }
    )
  );
};
