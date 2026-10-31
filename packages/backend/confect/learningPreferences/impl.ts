import type { CatalogCountrySchema } from "@nakafa/aksara-contracts/assessment/catalog";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  LearningPreferencePersistenceError,
  learningPreferencePersistenceFailedCode,
  learningPreferencePersistenceFailedMessage,
} from "@repo/backend/confect/learningPreferences/schema";
import type { Locale } from "@repo/backend/confect/lib/validators/contents";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import { readCatalogNode } from "@repo/backend/confect/tryouts/catalog/rows";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, Option } from "effect";

/** Maps unknown database failures into the preference persistence contract. */
function toLearningPreferencePersistenceError() {
  return new LearningPreferencePersistenceError({
    code: learningPreferencePersistenceFailedCode,
    message: learningPreferencePersistenceFailedMessage,
  });
}

/** Converts a try-out country row into the compact option used by navigation. */
export function toTryoutCountryOption(
  country: typeof CatalogCountrySchema.Type
) {
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
)(function* (userId: Id<"users">) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("learningPreferences")
    .get("by_userId", userId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.mapError(toLearningPreferencePersistenceError),
      Effect.catchDefect(() =>
        Effect.fail(toLearningPreferencePersistenceError())
      )
    );
});

/** Loads one try-out country of the active catalog in one locale, none when the catalog has no such country. */
export const readActiveTryoutCountry = Effect.fn(
  "learningPreferences.readActiveTryoutCountry"
)(function* (args: { readonly countryKey: string; readonly locale: Locale }) {
  const { snapshotId } = yield* loadActiveAssessment();
  const country = yield* readCatalogNode(snapshotId, {
    appLocale: args.locale,
    countryKey: args.countryKey,
    kind: "country",
  });
  return Option.getOrNull(country);
});

/** Reads the current explicit try-out country preference. */
export const readCurrentTryoutCountry = Effect.fn(
  "learningPreferences.readCurrentTryoutCountry"
)(function* (args: { readonly locale: Locale; readonly userId: Id<"users"> }) {
  const preference = yield* readLearningPreferenceByUserId(args.userId);
  if (!preference?.preferredTryoutCountryKey) {
    return null;
  }
  const country = yield* readActiveTryoutCountry({
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
  now,
  programKey,
  userId,
}: {
  now: number;
  programKey: string | null;
  userId: Id<"users">;
}) {
  const writer = yield* DatabaseWriter;
  const current = yield* readLearningPreferenceByUserId(userId);
  if (!current) {
    if (programKey === null) {
      return null;
    }
    return yield* writer
      .table("learningPreferences")
      .insert({
        preferredCurriculumProgramKey: programKey,
        updatedAt: now,
        userId,
      })
      .pipe(
        Effect.mapError(toLearningPreferencePersistenceError),
        Effect.catchDefect(() =>
          Effect.fail(toLearningPreferencePersistenceError())
        )
      );
  }
  if (current.preferredCurriculumProgramKey === (programKey ?? undefined)) {
    return current._id;
  }
  yield* writer
    .table("learningPreferences")
    .patch(current._id, {
      preferredCurriculumProgramKey: programKey ?? undefined,
      updatedAt: now,
    })
    .pipe(
      Effect.mapError(toLearningPreferencePersistenceError),
      Effect.catchDefect(() =>
        Effect.fail(toLearningPreferencePersistenceError())
      )
    );
  return current._id;
});

/** Creates or updates the current user's preferred try-out country key. */
export const upsertPreferredTryoutCountry = Effect.fn(
  "learningPreferences.upsertPreferredTryoutCountry"
)(function* ({
  countryKey,
  now,
  userId,
}: {
  countryKey: string;
  now: number;
  userId: Id<"users">;
}) {
  const writer = yield* DatabaseWriter;
  const current = yield* readLearningPreferenceByUserId(userId);
  if (!current) {
    return yield* writer
      .table("learningPreferences")
      .insert({
        preferredTryoutCountryKey: countryKey,
        updatedAt: now,
        userId,
      })
      .pipe(
        Effect.mapError(toLearningPreferencePersistenceError),
        Effect.catchDefect(() =>
          Effect.fail(toLearningPreferencePersistenceError())
        )
      );
  }
  if (current.preferredTryoutCountryKey === countryKey) {
    return current._id;
  }
  yield* writer
    .table("learningPreferences")
    .patch(current._id, {
      preferredTryoutCountryKey: countryKey,
      updatedAt: now,
    })
    .pipe(
      Effect.mapError(toLearningPreferencePersistenceError),
      Effect.catchDefect(() =>
        Effect.fail(toLearningPreferencePersistenceError())
      )
    );
  return current._id;
});

/**
 * Pauses or resumes the current user's Nina memory. Memory is on while the row
 * or its pause mark is absent, so resuming creates nothing. The caller declares
 * no persistence error, so a failed read or write dies.
 */
export const setNinaMemoryPaused = Effect.fn(
  "learningPreferences.setNinaMemoryPaused"
)(function* ({
  now,
  paused,
  userId,
}: {
  now: number;
  paused: boolean;
  userId: Id<"users">;
}) {
  const writer = yield* DatabaseWriter;
  const current = yield* readLearningPreferenceByUserId(userId);
  if (!current) {
    if (paused) {
      yield* writer
        .table("learningPreferences")
        .insert({ ninaMemoryPaused: true, updatedAt: now, userId });
    }
    return;
  }
  if ((current.ninaMemoryPaused === true) === paused) {
    return;
  }
  yield* writer.table("learningPreferences").patch(current._id, {
    ninaMemoryPaused: paused ? true : undefined,
    updatedAt: now,
  });
}, Effect.orDie);

/**
 * Marks that the current user asked to delete every Nina memory at `now`. The
 * mark only moves forward, so an older request never shows what a newer one
 * hid. The row is created when the learner has none. The caller declares no
 * persistence error, so a failed read or write dies.
 */
export const setNinaMemoryCleared = Effect.fn(
  "learningPreferences.setNinaMemoryCleared"
)(function* ({ now, userId }: { now: number; userId: Id<"users"> }) {
  const writer = yield* DatabaseWriter;
  const current = yield* readLearningPreferenceByUserId(userId);
  if (!current) {
    yield* writer
      .table("learningPreferences")
      .insert({ ninaMemoryClearedAt: now, updatedAt: now, userId });
    return;
  }
  yield* writer.table("learningPreferences").patch(current._id, {
    ninaMemoryClearedAt: Math.max(current.ninaMemoryClearedAt ?? now, now),
    updatedAt: now,
  });
}, Effect.orDie);
