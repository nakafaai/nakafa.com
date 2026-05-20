import { Option, Schema } from "effect";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const StateSchema = Schema.Struct({
  slug: Schema.String,
  visibleExplanations: Schema.Record({
    key: Schema.String,
    value: Schema.Boolean,
  }),
  timeSpent: Schema.Record({
    key: Schema.String,
    value: Schema.Number,
  }),
  showStats: Schema.Boolean,
}).pipe(Schema.mutable);
type State = Schema.Schema.Type<typeof StateSchema>;

/**
 * Actions available in the exercise store.
 */
const initialState = ({ slug }: { slug: string }): State => ({
  slug,
  visibleExplanations: {},
  timeSpent: {},
  showStats: true,
});

interface Actions {
  resetTimeSpent: () => void;
  setShowStats: (showStats: boolean) => void;
  setTimeSpent: (exerciseNumber: number, time: number) => void;
  toggleAnswer: (exerciseNumber: number) => void;
}

export type ExerciseStore = State & Actions;

export const createExerciseStore = ({ slug }: { slug: string }) =>
  createStore<ExerciseStore>()(
    persist(
      immer((set) => ({
        ...initialState({ slug }),

        toggleAnswer: (exerciseNumber) =>
          set((state) => {
            state.visibleExplanations[exerciseNumber] =
              !state.visibleExplanations[exerciseNumber];
          }),

        setTimeSpent: (exerciseNumber, time) =>
          set((state) => {
            state.timeSpent[exerciseNumber] = time;
          }),

        setShowStats: (showStats) =>
          set((state) => {
            state.showStats = showStats;
          }),

        resetTimeSpent: () =>
          set((state) => {
            state.timeSpent = {};
          }),
      })),
      {
        name: `nakafa-exercise-${slug}`,
        storage: createJSONStorage(() => sessionStorage),
        version: 3,
        migrate: (persistedState) => {
          const state = Schema.decodeUnknownOption(StateSchema)(persistedState);

          if (Option.isNone(state)) {
            return initialState({ slug });
          }

          const data = state.value;

          if (!data.slug) {
            return initialState({ slug });
          }

          return data;
        },
      }
    )
  );
