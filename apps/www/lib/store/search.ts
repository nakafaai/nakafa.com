import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface State {
  open: boolean;
  query: string;
}

interface Actions {
  setOpen: (open: boolean) => void;
  setQuery: (query: string) => void;
}

export type SearchStore = State & Actions;

const initialState: State = {
  query: "",
  open: false,
};

export const createSearchStore = () =>
  createStore<SearchStore>()(
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
        version: 1,
      }
    )
  );
