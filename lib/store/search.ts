import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type State = {
  query: string;
  open: boolean;
};

type Actions = {
  setQuery: (query: string) => void;
  setOpen: (open: boolean) => void;
};

export const useSearchStore = create<State & Actions>()(
  persist(
    immer((set) => ({
      query: "",
      open: false,

      // Actions are functions and not saved to localStorage.
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
    }
  )
);
