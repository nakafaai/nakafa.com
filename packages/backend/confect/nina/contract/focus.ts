import { Id } from "@repo/backend/confect/_generated/id";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema, Struct } from "effect";

/** One try-out question the learner asked Nina about from a finished review. */
export const NinaFocusInputSchema = Schema.Struct({
  kind: Schema.Literal("tryout-question"),
  attemptId: Id("tryoutAttempts"),
  placementId: Id("tryoutAttemptPlacements"),
});

/** The verified question focus frozen into a turn's context pack. */
export const NinaFocusSchema = Schema.Struct({
  ...NinaFocusInputSchema.fields,
  questionOrder: Schema.Finite,
  sectionKey: tryoutRouteKeyValidator,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

/**
 * The focused question's facts read for one generation after entitlement is rechecked, as the text
 * the prompt quotes: the question and its official explanation as agent Markdown, the answer section
 * with the key beside the learner's answer, the language the question is written in, and how the
 * learner's answer graded. A document can nest deeper than a Convex value may, so the query that
 * reads them returns text.
 */
export const NinaFocusSourceSchema = Schema.Struct({
  answer: Schema.String,
  explanation: Schema.String,
  question: Schema.String,
  questionLanguage: Schema.String,
  questionOrder: Schema.Finite,
  result: Schema.Literals([
    "not answered",
    "answered correctly",
    "answered incorrectly",
    "answered, awaiting grading",
  ]),
});

export type NinaFocusInput = typeof NinaFocusInputSchema.Type;
export type NinaFocus = typeof NinaFocusSchema.Type;
export type NinaFocusSource = typeof NinaFocusSourceSchema.Type;
