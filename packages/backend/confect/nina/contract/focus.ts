import { Id } from "@repo/backend/confect/_generated/id";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import {
  tryoutResponseSelectionValidator,
  tryoutResponseSpecValidator,
} from "@repo/backend/confect/tryouts/response/model";
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

/** Signed question facts read for one generation after entitlement is rechecked. */
export const NinaFocusSourceSchema = Schema.Struct({
  questionOrder: Schema.Finite,
  questionLocale: appLocaleValidator,
  questionMdx: Schema.String,
  explanationMdx: Schema.String,
  responseSpec: tryoutResponseSpecValidator,
  selection: Schema.NullOr(tryoutResponseSelectionValidator),
  isCorrect: Schema.NullOr(Schema.Boolean),
});

export type NinaFocusInput = Schema.Schema.Type<typeof NinaFocusInputSchema>;
export type NinaFocus = Schema.Schema.Type<typeof NinaFocusSchema>;
export type NinaFocusSource = Schema.Schema.Type<typeof NinaFocusSourceSchema>;
