import { ActiveAppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { LearningProgramKindSchema } from "@nakafa/aksara-contracts/program/spec";
import type { TryoutCountry } from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { readTryoutCatalogRowByIdentity } from "@repo/backend/convex/tryouts/catalog/row";
import type { LearningInterest } from "@repo/contents/_types/learner/preferences";
import { Effect, Schema } from "effect";

type PreferenceCtx = MutationCtx | QueryCtx;
type LearningProgramKind = typeof LearningProgramKindSchema.Type;
const learningPreferencePersistenceFailedCode =
  "LEARNING_PREFERENCE_PERSISTENCE_FAILED";
const learningPreferencePersistenceFailedMessage =
  "Unable to read or persist learning preferences.";

/** Expected database failure while reading or writing learner preferences. */
export class LearningPreferencePersistenceError extends Schema.TaggedError<LearningPreferencePersistenceError>()(
  "LearningPreferencePersistenceError",
  {
    code: Schema.Literal(learningPreferencePersistenceFailedCode),
    message: Schema.Literal(learningPreferencePersistenceFailedMessage),
  }
) {}

/** Maps unknown database failures into the preference persistence contract. */
function toLearningPreferencePersistenceError() {
  return new LearningPreferencePersistenceError({
    code: learningPreferencePersistenceFailedCode,
    message: learningPreferencePersistenceFailedMessage,
  });
}

/** Runs one preference database operation through its typed error channel. */
function tryLearningPreferencePersistence<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: toLearningPreferencePersistenceError,
    try: operation,
  });
}

/** Converts a try-out country row into the compact option used by navigation. */
export function toTryoutCountryOption(country: TryoutCountry) {
  return {
    countryCode: country.countryCode,
    key: country.countryKey,
    publicPath: country.publicPath,
    title: country.title,
  };
}

/** Loads one preference row through the typed persistence error channel. */
export const readLearningPreferenceByUserId = Effect.fn(
  "learningPreferences.readLearningPreferenceByUserId"
)(function* (ctx: PreferenceCtx, userId: Id<"users">) {
  return yield* tryLearningPreferencePersistence(() =>
    ctx.db
      .query("learningPreferences")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .unique()
  );
});

/** Loads one active try-out country from the signed catalog. */
export const readActiveTryoutCountry = Effect.fn(
  "learningPreferences.readActiveTryoutCountry"
)(function* (
  ctx: QueryCtx,
  args: { readonly countryKey: string; readonly locale: Locale }
) {
  const owner = yield* loadTryoutOwner(ctx);
  const identity = tryoutCatalogNodeIdentity({
    appLocale: ActiveAppLocaleSchema.make(args.locale),
    countryKey: args.countryKey,
    kind: "country",
  });
  const country = yield* readTryoutCatalogRowByIdentity(
    ctx,
    owner.snapshotId,
    identity
  );
  return country?.kind === "country" ? country : null;
});

/** Reads the current explicit try-out country preference. */
export const readCurrentTryoutCountry = Effect.fn(
  "learningPreferences.readCurrentTryoutCountry"
)(function* (
  ctx: QueryCtx,
  args: { readonly locale: Locale; readonly userId: Id<"users"> }
) {
  const preference = yield* readLearningPreferenceByUserId(ctx, args.userId);

  if (!preference?.preferredTryoutCountryKey) {
    return null;
  }

  const country = yield* readActiveTryoutCountry(ctx, {
    countryKey: preference.preferredTryoutCountryKey,
    locale: args.locale,
  });

  if (!country) {
    return null;
  }

  return {
    country,
    preferredTryoutCountryKey: preference.preferredTryoutCountryKey,
  };
});

/** Sets or clears the current user's preferred curriculum program key. */
export const setPreferredCurriculumProgram = Effect.fn(
  "learningPreferences.setPreferredCurriculumProgram"
)(function* ({
  ctx,
  now,
  programKey,
  userId,
}: {
  ctx: MutationCtx;
  now: number;
  programKey: string | null;
  userId: Id<"users">;
}) {
  const current = yield* readLearningPreferenceByUserId(ctx, userId);

  if (!current) {
    if (programKey === null) {
      return null;
    }
    return yield* tryLearningPreferencePersistence(() =>
      ctx.db.insert("learningPreferences", {
        preferredCurriculumProgramKey: programKey,
        updatedAt: now,
        userId,
      })
    );
  }

  if (current.preferredCurriculumProgramKey === (programKey ?? undefined)) {
    return current._id;
  }

  yield* tryLearningPreferencePersistence(() =>
    ctx.db.patch(current._id, {
      preferredCurriculumProgramKey: programKey ?? undefined,
      updatedAt: now,
    })
  );

  return current._id;
});

/** Creates or updates the current user's canonical learning selection. */
export const saveLearningSelection = Effect.fn(
  "learningPreferences.saveLearningSelection"
)(function* ({
  ctx,
  interest,
  now,
  programKey,
  programKind,
  replaceCurriculumPreference,
  selectionUpdatedAt = now,
  userId,
}: {
  ctx: MutationCtx;
  interest: LearningInterest;
  now: number;
  programKey: string;
  programKind: LearningProgramKind;
  replaceCurriculumPreference: boolean;
  selectionUpdatedAt?: number;
  userId: Id<"users">;
}) {
  const current = yield* readLearningPreferenceByUserId(ctx, userId);
  const shouldSetCurriculumPreference =
    programKind === "school-curriculum" &&
    (replaceCurriculumPreference ||
      current?.preferredCurriculumProgramKey === undefined);
  const curriculumPreference = shouldSetCurriculumPreference
    ? { preferredCurriculumProgramKey: programKey }
    : {};

  if (!current) {
    return yield* tryLearningPreferencePersistence(() =>
      ctx.db.insert("learningPreferences", {
        learningInterest: interest,
        primaryProgramKey: programKey,
        ...curriculumPreference,
        selectionUpdatedAt,
        updatedAt: now,
        userId,
      })
    );
  }

  if (
    current.learningInterest === interest &&
    current.primaryProgramKey === programKey &&
    (!shouldSetCurriculumPreference ||
      current.preferredCurriculumProgramKey === programKey)
  ) {
    if (
      current.selectionUpdatedAt !== undefined &&
      current.selectionUpdatedAt >= selectionUpdatedAt
    ) {
      return current._id;
    }

    yield* tryLearningPreferencePersistence(() =>
      ctx.db.patch(current._id, {
        selectionUpdatedAt,
        updatedAt: now,
      })
    );

    return current._id;
  }

  yield* tryLearningPreferencePersistence(() =>
    ctx.db.patch(current._id, {
      learningInterest: interest,
      primaryProgramKey: programKey,
      ...curriculumPreference,
      selectionUpdatedAt,
      updatedAt: now,
    })
  );

  return current._id;
});

/** Creates or updates the current user's preferred try-out country key. */
export const upsertPreferredTryoutCountry = Effect.fn(
  "learningPreferences.upsertPreferredTryoutCountry"
)(function* ({
  countryKey,
  ctx,
  now,
  userId,
}: {
  countryKey: string;
  ctx: MutationCtx;
  now: number;
  userId: Id<"users">;
}) {
  const current = yield* readLearningPreferenceByUserId(ctx, userId);

  if (!current) {
    return yield* tryLearningPreferencePersistence(() =>
      ctx.db.insert("learningPreferences", {
        preferredTryoutCountryKey: countryKey,
        updatedAt: now,
        userId,
      })
    );
  }

  if (current.preferredTryoutCountryKey === countryKey) {
    return current._id;
  }

  yield* tryLearningPreferencePersistence(() =>
    ctx.db.patch(current._id, {
      preferredTryoutCountryKey: countryKey,
      updatedAt: now,
    })
  );

  return current._id;
});
