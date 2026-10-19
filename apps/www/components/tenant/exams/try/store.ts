import { Array as Arr, Record as Rec, Schema } from "effect";
import { createStore } from "zustand";

/**
 * The options a teacher chose in one try, by question ID. A question with no chosen option has
 * no entry, so clearing an answer removes it.
 */
const TryState = Schema.Struct({
  responses: Schema.Record(Schema.String, Schema.Array(Schema.String)),
});

/** What the teacher does while trying the exam. */
interface TryActions {
  /**
   * Takes the options chosen for one question, which replace the ones it held. An empty response
   * clears the question's answer.
   */
  readonly choose: (questionId: string, response: readonly string[]) => void;
}

/** The try of one exam, with its actions. */
export type ExamTry = typeof TryState.Type & TryActions;

/**
 * Creates the try of one exam. Its answers stay in the browser: nothing the store holds is sent, so
 * a try leaves no attempt and no score behind. Each try page creates its own store, once.
 */
export const createExamTry = () =>
  createStore<ExamTry>()((set) => ({
    choose: (questionId, response) =>
      set((state) => ({
        responses: Arr.isReadonlyArrayNonEmpty(response)
          ? Rec.set(state.responses, questionId, Arr.fromIterable(response))
          : Rec.remove(state.responses, questionId),
      })),
    responses: {},
  }));
