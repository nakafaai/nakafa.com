import { Id } from "@repo/backend/confect/_generated/id";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import {
  Outcome,
  ResponseSpec,
  Selection,
} from "@repo/backend/confect/response/model";
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
  responseSpec: ResponseSpec,
  selection: Schema.NullOr(Selection),
  outcome: Schema.NullOr(Outcome),
});

export type NinaFocusInput = typeof NinaFocusInputSchema.Type;
export type NinaFocus = typeof NinaFocusSchema.Type;
export type NinaFocusSource = typeof NinaFocusSourceSchema.Type;
