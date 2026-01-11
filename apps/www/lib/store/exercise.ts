import * as z from "zod/mini";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const StateSchema = z.object({
  slug: z.string(),
  visibleExplanations: z.record(z.number(), z.boolean()),
  timeSpent: z.record(z.number(), z.number()),
  showStats: z.boolean(),
});
type State = z.infer<typeof StateSchema>;

interface Actions {
  toggleAnswer: (exerciseNumber: number) => void;
  setTimeSpent: (exerciseNumber: number, time: number) => void;
  setShowStats: (showStats: boolean) => void;
}

export type ExerciseStore = State & Actions;

const initialState = ({ slug }: { slug: string }): State => ({
  slug,
  visibleExplanations: {},
  timeSpent: {},
  showStats: true,
});

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
      })),
      {
        name: `nakafa-exercise-${slug}`,
        storage: createJSONStorage(() => sessionStorage),
        version: 3,
        migrate: (persistedState) => {
          const { data } = StateSchema.safeParse(persistedState);
          if (!data?.slug) {
            return initialState({ slug });
          }
          if (!data.timeSpent) {
            return { ...data, timeSpent: {} };
          }
          return data;
        },
      }
    )
  );
