import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  DEFAULT_GRADING_SCHEME,
  type GradingScheme,
  type gradingSchemeValidator,
  normalizeScheme,
} from "@repo/backend/confect/records/scheme";
import { Clock, Effect, Option } from "effect";

/** A stored version as a scheme, with its bands in order. */
const toScheme = (row: typeof gradingSchemeValidator.Type): GradingScheme =>
  normalizeScheme({ bands: row.bands, kktp: row.kktp });

/**
 * The scheme in force for a school now: its newest stored version that has taken
 * effect by the current time, or the built-in scheme when none has. The stored
 * version's ID comes with it, so a grade entered now can name it.
 */
export const schemeInForce = Effect.fn("records.version.inForce")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  const now = yield* Clock.currentTimeMillis;
  const stored = yield* (yield* DatabaseReader)
    .table("gradingSchemes")
    .index(
      "by_tenantId_and_effectiveFrom",
      (query) => query.eq("tenantId", tenantId).lte("effectiveFrom", now),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
  return Option.match(stored, {
    onNone: () => ({ id: undefined, scheme: DEFAULT_GRADING_SCHEME }),
    onSome: (row) => ({ id: row._id, scheme: toScheme(row) }),
  });
});

/**
 * The scheme that judged a grade: the stored version the grade names, or the
 * built-in scheme when it names none. A stored version never changes, so a grade
 * keeps the scheme of its entry however the school's schemes change later.
 */
export const schemeOf = Effect.fn("records.version.of")(function* (
  id: GenericId.GenericId<"gradingSchemes"> | undefined
) {
  if (id === undefined) {
    return DEFAULT_GRADING_SCHEME;
  }
  const row = yield* (yield* DatabaseReader)
    .table("gradingSchemes")
    .get(id)
    .pipe(Effect.orDie);
  return toScheme(row);
});
