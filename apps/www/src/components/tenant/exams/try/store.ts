import {
  ExamResponse,
  isAnswered,
} from "@repo/backend/confect/exams/sittings/response";
import { Record as Rec, Schema } from "effect";
import { createStore } from "zustand";

/**
 * The responses a teacher gave in one try, by question ID: the options chosen, or the text typed.
 * A question with no answer has no entry, so clearing an answer removes it.
 */
const TryState = Schema.Struct({
  responses: Schema.Record(Schema.String, ExamResponse),
});

/** What the teacher does while trying the exam. */
interface TryActions {
  /**
   * Takes the response given to one question, which replaces the one it held. A response that
   * answers nothing, no option or blank text, clears the question's answer.
   */
  readonly choose: (questionId: string, response: ExamResponse) => void;
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
        responses: isAnswered(response)
          ? Rec.set(state.responses, questionId, response)
          : Rec.remove(state.responses, questionId),
      })),
    responses: {},
  }));
