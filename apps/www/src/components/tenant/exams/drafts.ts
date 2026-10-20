import { type Id, Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Schema } from "effect";
import { createStore } from "zustand";

/** The exams the list shows while the server saves them, by their placeholder IDs. */
const DraftsState = Schema.Struct({
  ids: Schema.Array(IdSchema("exams")),
});

/** The actions that start and end the saving of one exam. */
interface DraftsActions {
  /** Ends the saving of an exam, once the server answered or refused it. */
  readonly end: (id: Id<"exams">) => void;
  /** Starts the saving of an exam, so its row in the list is inert until the server answers. */
  readonly start: (id: Id<"exams">) => void;
}

/** The state of the exams that are being saved, with its actions. */
export type ExamDrafts = typeof DraftsState.Type & DraftsActions;

/** Creates the drafts of one list. Each list creates its own, once. */
export const createExamDrafts = () =>
  createStore<ExamDrafts>()((set) => ({
    end: (id) =>
      set((state) => ({
        ids: Arr.filter(state.ids, (current) => current !== id),
      })),
    ids: [],
    start: (id) => set((state) => ({ ids: Arr.append(state.ids, id) })),
  }));
