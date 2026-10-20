import { Schema } from "effect";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const StateSchema = Schema.Struct({
  activated: Schema.Boolean,
  open: Schema.Boolean,
  query: Schema.String,
});

type State = typeof StateSchema.Type;

interface Actions {
  setOpen: (open: boolean) => void;
  setQuery: (query: string) => void;
}

export type SearchStore = State & Actions;

const initialState: State = {
  activated: false,
  query: "",
  open: false,
};

export const createSearchStore = () =>
  createStore<SearchStore>()(
    persist(
      (set) => ({
        ...initialState,

        setQuery: (query: string) => {
          set((state) => (state.query === query ? state : { query }));
        },
        setOpen: (open: boolean) => {
          set((state) => {
            const activated = state.activated || open;
            if (activated === state.activated && open === state.open) {
              return state;
            }
            return { activated, open };
          });
        },
      }),
      {
        name: "nakafa-search",
        storage: createJSONStorage(() => sessionStorage),
        version: 1,
      }
    )
  );
