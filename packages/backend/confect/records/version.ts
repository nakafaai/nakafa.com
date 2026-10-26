import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  DEFAULT_GRADING_SCHEME,
  type GradingScheme,
  type gradingSchemeValidator,
  normalizeScheme,
} from "@repo/backend/confect/records/scheme";
import { Clock, Effect, Option } from "effect";

/**
 * The effective time of the built-in version. It precedes every date, so a version
 * that a school stores later takes precedence once it is in force, and the built-in
 * version never hides it.
 */
const BUILT_IN_EFFECTIVE_FROM = 0;

/** A stored version as a scheme, with its bands in order. */
const toScheme = (row: typeof gradingSchemeValidator.Type): GradingScheme =>
  normalizeScheme({ bands: row.bands, kktp: row.kktp });

/**
 * Stores the built-in scheme as the school's first version, in the transaction of the
 * entry that needs it. No person chose it, so no journal entry records it.
 */
const storeBuiltIn = Effect.fn("records.version.storeBuiltIn")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  const id = yield* (yield* DatabaseWriter)
    .table("gradingSchemes")
    .insert({
      bands: DEFAULT_GRADING_SCHEME.bands,
      effectiveFrom: BUILT_IN_EFFECTIVE_FROM,
      kktp: DEFAULT_GRADING_SCHEME.kktp,
      tenantId,
    })
    .pipe(Effect.orDie);
  return { id, scheme: DEFAULT_GRADING_SCHEME };
});

/** The stored version in force for a school now: the newest that has taken effect, if any. */
const storedInForce = Effect.fn("records.version.stored")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  const now = yield* Clock.currentTimeMillis;
  return yield* (yield* DatabaseReader)
    .table("gradingSchemes")
    .index(
      "by_tenantId_and_effectiveFrom",
      (query) => query.eq("tenantId", tenantId).lte("effectiveFrom", now),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * The scheme in force for a school now, as the stored version that its grades name:
 * the newest version that has taken effect by the current time. A school with none in
 * force gets the built-in scheme stored as its first version, so every grade names a
 * stored version and no read falls back to the code's constant.
 */
export const schemeInForce = Effect.fn("records.version.inForce")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  const stored = yield* storedInForce(tenantId);
  return yield* Option.match(stored, {
    onNone: () => storeBuiltIn(tenantId),
    onSome: (row) => Effect.succeed({ id: row._id, scheme: toScheme(row) }),
  });
});

/**
 * The scheme that judges the next entry of a school, read without writing: the version
 * in force, or the built-in scheme that the first entry stores as the school's first
 * version. A gradebook judges a value as it is typed with it, before the server does.
 */
export const schemeForEntry = Effect.fn("records.version.forEntry")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  const stored = yield* storedInForce(tenantId);
  return Option.match(stored, {
    onNone: () => DEFAULT_GRADING_SCHEME,
    onSome: toScheme,
  });
});

/**
 * The newest stored version of a school, in force or not. A new version must take
 * effect after it, or it would never be in force.
 */
export const newestVersion = Effect.fn("records.version.newest")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  return yield* (yield* DatabaseReader)
    .table("gradingSchemes")
    .index(
      "by_tenantId_and_effectiveFrom",
      (query) => query.eq("tenantId", tenantId),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * The scheme that a grade names: the stored version that judged it. A stored version
 * never changes, so a grade keeps the scheme of its entry however the school's schemes
 * change later.
 */
export const schemeOf = Effect.fn("records.version.of")(function* (
  id: GenericId.GenericId<"gradingSchemes">
) {
  const row = yield* (yield* DatabaseReader)
    .table("gradingSchemes")
    .get(id)
    .pipe(Effect.orDie);
  return toScheme(row);
});
