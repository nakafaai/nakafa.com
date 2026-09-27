import { DatabaseReader, DatabaseWriter } from "@confect/server";
import { ActiveAppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { TryoutCountry } from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  LearningPreferencePersistenceError,
  learningPreferencePersistenceFailedCode,
  learningPreferencePersistenceFailedMessage,
} from "@repo/backend/confect/learningPreferences/schema";
import type { Locale } from "@repo/backend/confect/lib/validators/contents";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { loadTryoutOwner } from "@repo/backend/content/tryout/owner";
import { readTryoutCatalogRowByIdentity } from "@repo/backend/content/tryout/row";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { Effect, flow } from "effect";

type PreferenceCtx = MutationCtx | QueryCtx;
/** Maps unknown database failures into the preference persistence contract. */
function toLearningPreferencePersistenceError() {
  return new LearningPreferencePersistenceError({
    code: learningPreferencePersistenceFailedCode,
    message: learningPreferencePersistenceFailedMessage,
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
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  return yield* database
    .table("learningPreferences")
    .get("by_userId", userId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie,
      Effect.catchDefect(
        flow(toLearningPreferencePersistenceError, Effect.fail)
      )
    );
});

/** Loads one active try-out country from the signed catalog. */
export const readActiveTryoutCountry = Effect.fn(
  "learningPreferences.readActiveTryoutCountry"
)(function* (
  ctx: QueryCtx,
  args: {
    readonly countryKey: string;
    readonly locale: Locale;
  }
) {
  const owner = yield* loadTryoutOwner().pipe(
    Effect.provide(convexTryoutLayer(ctx))
  );
  const identity = tryoutCatalogNodeIdentity({
    appLocale: ActiveAppLocaleSchema.make(args.locale),
    countryKey: args.countryKey,
    kind: "country",
  });
  const country = yield* readTryoutCatalogRowByIdentity(
    owner.snapshotId,
    identity
  ).pipe(Effect.provide(convexTryoutLayer(ctx)));
  return country?.kind === "country" ? country : null;
});

/** Reads the current explicit try-out country preference. */
export const readCurrentTryoutCountry = Effect.fn(
  "learningPreferences.readCurrentTryoutCountry"
)(function* (
  ctx: QueryCtx,
  args: {
    readonly locale: Locale;
    readonly userId: Id<"users">;
  }
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
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const current = yield* readLearningPreferenceByUserId(ctx, userId);
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
        Effect.orDie,
        Effect.catchDefect(
          flow(toLearningPreferencePersistenceError, Effect.fail)
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
      Effect.orDie,
      Effect.catchDefect(
        flow(toLearningPreferencePersistenceError, Effect.fail)
      )
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
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const current = yield* readLearningPreferenceByUserId(ctx, userId);
  if (!current) {
    return yield* writer
      .table("learningPreferences")
      .insert({
        preferredTryoutCountryKey: countryKey,
        updatedAt: now,
        userId,
      })
      .pipe(
        Effect.orDie,
        Effect.catchDefect(
          flow(toLearningPreferencePersistenceError, Effect.fail)
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
      Effect.orDie,
      Effect.catchDefect(
        flow(toLearningPreferencePersistenceError, Effect.fail)
      )
    );
  return current._id;
});
