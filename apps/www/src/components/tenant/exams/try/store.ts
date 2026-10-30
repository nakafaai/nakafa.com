import {
  ExamResponse,
  isAnswered,
} from "@repo/backend/confect/exams/sittings/response";
import { Record as Rec, Schema } from "effect";
import { createStore } from "zustand";

/**
 * The responses a teacher gave in one try, by question ID: the options chosen, or the text typed.
 * A question with no answer has no entry, so clearing an answer removes it. The flagged questions
 * are kept the same way, as a sitting's navigator marks them.
 */
const TryState = Schema.Struct({
  flags: Schema.Record(Schema.String, Schema.Literal(true)),
  responses: Schema.Record(Schema.String, ExamResponse),
});

/** What the teacher does while trying the exam. */
interface TryActions {
  /**
   * Takes the response given to one question, which replaces the one it held. A response that
   * answers nothing, no option or blank text, clears the question's answer.
   */
  readonly choose: (questionId: string, response: ExamResponse) => void;
  /** Flags one question to come back to it, or takes its flag off, as a student's flag does. */
  readonly flag: (questionId: string) => void;
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
    flag: (questionId) =>
      set((state) => ({
        flags: Rec.has(state.flags, questionId)
          ? Rec.remove(state.flags, questionId)
          : Rec.set(state.flags, questionId, true as const),
      })),
    flags: {},
    responses: {},
  }));
