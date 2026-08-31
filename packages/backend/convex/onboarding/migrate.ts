import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
  type MutationCtx,
} from "@repo/backend/convex/_generated/server";
import { readLearningPreferenceByUserId } from "@repo/backend/convex/learningPreferences/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { readOnboardingProfileByUserId } from "@repo/backend/convex/onboarding/impl";
import type {
  OnboardingFocus,
  OnboardingRegion,
} from "@repo/backend/convex/onboarding/schema";
import {
  isSelfSelectableUserRole,
  type SelfSelectableUserRole,
} from "@repo/backend/convex/users/roles";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Clock, Effect, Schema } from "effect";

const MIGRATION_PAGE_SIZE = 50;
const MIGRATION_RUN_PAGE_LIMIT = 64;
const migrationPageFailedCode = "ONBOARDING_MIGRATION_PAGE_FAILED";

/** Expected operational failure while invoking one onboarding migration page. */
class OnboardingMigrationError extends Schema.TaggedError<OnboardingMigrationError>()(
  "OnboardingMigrationError",
  {
    code: Schema.Literal(migrationPageFailedCode),
    message: Schema.Literal("Unable to migrate the next onboarding page."),
  }
) {}

/** Runs one migration operation through the stable internal error contract. */
function tryOnboardingMigration<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: () =>
      new OnboardingMigrationError({
        code: migrationPageFailedCode,
        message: "Unable to migrate the next onboarding page.",
      }),
    try: operation,
  });
}

interface MigratedOnboardingAnswers {
  readonly focus: OnboardingFocus;
  readonly region: OnboardingRegion;
  readonly role: SelfSelectableUserRole;
}

const migrationPageResultValidator = v.object({
  alreadyPresent: v.number(),
  continueCursor: v.string(),
  created: v.number(),
  isDone: v.boolean(),
  requiresOnboarding: v.number(),
});
type MigrationPageResult = Infer<typeof migrationPageResultValidator>;

const migratePageReference = makeFunctionReference<
  "mutation",
  { cursor: string | null },
  MigrationPageResult
>("onboarding/migrate:page");

/** Reads a normal end-user role without migrating privileged roles. */
function readSelfSelectableRole(
  role: Doc<"users">["role"]
): SelfSelectableUserRole | undefined {
  return isSelfSelectableUserRole(role) ? role : undefined;
}

/** Maps one canonical curriculum key to the least-assumptive product region. */
function readCurriculumRegion(
  programKey: string | undefined
): OnboardingRegion | undefined {
  switch (programKey) {
    case "merdeka":
      return "indonesia";
    case "singapore-moe":
      return "singapore";
    case "cambridge-international":
      return "international";
    case "united-states":
      return "united-states";
    default:
      return undefined;
  }
}

/** Resolves the explicit focus saved by the old onboarding flow. */
function readLegacyInterestFocus(
  preference: Doc<"learningPreferences">
): OnboardingFocus | undefined {
  switch (preference.learningInterest) {
    case "school-curriculum":
      return "learning";
    case "assessment-prep":
    case "exam-prep":
      return "tryout";
    default:
      return undefined;
  }
}

/** Resolves a focus only when the old primary program makes it unambiguous. */
function readLegacyProgramFocus(
  preference: Doc<"learningPreferences">
): OnboardingFocus | undefined {
  if (
    preference.primaryProgramKey === "assessment" ||
    preference.primaryProgramKey === "snbt" ||
    preference.primaryProgramKey === "tka"
  ) {
    return "tryout";
  }

  return readCurriculumRegion(preference.primaryProgramKey)
    ? "learning"
    : undefined;
}

/** Combines old focus signals without guessing when they disagree. */
function readLegacyFocus(
  preference: Doc<"learningPreferences">
): OnboardingFocus | undefined {
  const interestFocus = readLegacyInterestFocus(preference);
  const programFocus = readLegacyProgramFocus(preference);
  if (interestFocus && programFocus && interestFocus !== programFocus) {
    return undefined;
  }

  return (
    interestFocus ??
    programFocus ??
    (readCurriculumRegion(preference.preferredCurriculumProgramKey)
      ? "learning"
      : undefined)
  );
}

/** Derives a complete new profile only from unambiguous legacy facts. */
export function deriveMigratedOnboardingAnswers(
  user: Pick<Doc<"users">, "deletedAt" | "role">,
  preference: Doc<"learningPreferences"> | null
): MigratedOnboardingAnswers | null {
  if (user.deletedAt !== undefined || !preference) {
    return null;
  }

  const role = readSelfSelectableRole(user.role);
  const focus = readLegacyFocus(preference);
  const region =
    readCurriculumRegion(preference.preferredCurriculumProgramKey) ??
    readCurriculumRegion(preference.primaryProgramKey) ??
    (preference.primaryProgramKey === "snbt" ||
    preference.primaryProgramKey === "tka"
      ? "indonesia"
      : undefined);

  if (!(role && focus && region)) {
    return null;
  }

  return { focus, region, role };
}

/** Migrates one bounded page of legacy users into completed onboarding profiles. */
const migrateLegacyOnboardingPage = Effect.fn("onboarding.migrateLegacyPage")(
  function* (ctx: MutationCtx, cursor: string | null) {
    const users = yield* tryOnboardingMigration(() =>
      ctx.db.query("users").paginate({ cursor, numItems: MIGRATION_PAGE_SIZE })
    );
    const now = yield* Clock.currentTimeMillis;
    let alreadyPresent = 0;
    let created = 0;
    let requiresOnboarding = 0;

    for (const user of users.page) {
      const profile = yield* readOnboardingProfileByUserId(ctx, user._id);
      if (profile) {
        alreadyPresent += 1;
        continue;
      }

      const preference = yield* readLearningPreferenceByUserId(ctx, user._id);
      const answers = deriveMigratedOnboardingAnswers(user, preference);
      if (!answers) {
        requiresOnboarding += 1;
        continue;
      }

      yield* tryOnboardingMigration(() =>
        ctx.db.insert("onboardingProfiles", {
          ...answers,
          completedAt: now,
          updatedAt: now,
          userId: user._id,
        })
      );
      created += 1;
    }

    return {
      alreadyPresent,
      continueCursor: users.continueCursor,
      created,
      isDone: users.isDone,
      requiresOnboarding,
    };
  }
);

/** Drains a bounded series of transactional pages and returns a resume cursor. */
const runLegacyOnboardingMigration = Effect.fn("onboarding.runLegacyMigration")(
  function* (ctx: ActionCtx, initialCursor: string | null) {
    let pageCursor = initialCursor;
    let continueCursor = "";
    let alreadyPresent = 0;
    let created = 0;
    let requiresOnboarding = 0;

    for (let index = 0; index < MIGRATION_RUN_PAGE_LIMIT; index += 1) {
      const receipt = yield* tryOnboardingMigration(() =>
        ctx.runMutation(migratePageReference, { cursor: pageCursor })
      );
      alreadyPresent += receipt.alreadyPresent;
      created += receipt.created;
      requiresOnboarding += receipt.requiresOnboarding;
      continueCursor = receipt.continueCursor;
      pageCursor = continueCursor;

      if (receipt.isDone) {
        return {
          alreadyPresent,
          continueCursor,
          created,
          isDone: true,
          requiresOnboarding,
        };
      }
    }

    return {
      alreadyPresent,
      continueCursor,
      created,
      isDone: false,
      requiresOnboarding,
    };
  }
);

/**
 * Temporary expand/switch migration for issue 320.
 * Remove after every production page is complete and legacy callers are quiet.
 */
export const page = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: migrationPageResultValidator,
  handler: (ctx, { cursor }) =>
    runConvexProgram(migrateLegacyOnboardingPage(ctx, cursor)),
});

/** Drains at most 3,200 users and can resume from the returned cursor. */
export const run = internalAction({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: migrationPageResultValidator,
  handler: (ctx, { cursor }) =>
    runConvexProgram(runLegacyOnboardingMigration(ctx, cursor)),
});
