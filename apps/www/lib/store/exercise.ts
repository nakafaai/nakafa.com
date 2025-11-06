import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type State = {
  setId: string;
  totalExercises: number;
  answers: Record<number, { selected: string; isCorrect: boolean } | null>;
  visibleExplanations: Record<number, boolean>;
};

type Actions = {
  selectAnswer: ({
    exerciseNumber,
    choice,
    correctAnswer,
  }: {
    exerciseNumber: number;
    choice: string;
    correctAnswer: string;
  }) => void;
  clearAnswer: (exerciseNumber: number) => void;
  toggleAnswer: (exerciseNumber: number) => void;
  getScore: () => { correct: number; total: number; percentage: number };
  reset: () => void;
};

export type ExerciseStore = State & Actions;

const initialState = ({
  setId,
  totalExercises,
}: {
  setId: string;
  totalExercises: number;
}): State => ({
  setId,
  totalExercises,
  answers: {},
  visibleExplanations: {},
});

export const createExerciseStore = ({
  setId,
  totalExercises,
}: {
  setId: string;
  totalExercises: number;
}) =>
  createStore<ExerciseStore>()(
    persist(
      immer((set, get) => ({
        ...initialState({ setId, totalExercises }),

        selectAnswer: ({ exerciseNumber, choice, correctAnswer }) =>
          set((state) => {
            state.answers[exerciseNumber] = {
              selected: choice,
              isCorrect: choice === correctAnswer,
            };
          }),

        clearAnswer: (exerciseNumber) =>
          set((state) => {
            state.answers[exerciseNumber] = null;
          }),

        toggleAnswer: (exerciseNumber) =>
          set((state) => {
            state.visibleExplanations[exerciseNumber] =
              !state.visibleExplanations[exerciseNumber];
          }),

        getScore: () => {
          const answers = get().answers;
          const allAnswers = Object.values(answers).filter(
            (answer) => answer !== null
          );
          const correct = allAnswers.filter(
            (answer) => answer.isCorrect
          ).length;
          const total = get().totalExercises;
          const percentage = total > 0 ? (correct / total) * 100 : 0;

          return { correct, total, percentage };
        },

        reset: () =>
          set((state) => {
            state.answers = {};
            state.visibleExplanations = {};
          }),
      })),
      {
        name: "nakafa-exercise",
        storage: createJSONStorage(() => sessionStorage),
        version: 1,
      }
    )
  );
