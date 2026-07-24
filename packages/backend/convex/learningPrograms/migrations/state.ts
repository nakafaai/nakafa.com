import type { LearningProgram } from "@nakafa/aksara-contracts/program/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  migrationFail,
  type programMigrationCountsValidator,
} from "@repo/backend/convex/learningPrograms/migrations/spec";
import { LEARNING_INTEREST_PROGRAM_KIND_MATCHES } from "@repo/contents/_types/program/schema";
import type { Infer } from "convex/values";
import { Effect } from "effect";

const STATE_LIMITS = {
  coverage: 200,
  items: 500,
  plans: 300,
  profiles: 200,
} as const;

type ExpectedCounts = Infer<typeof programMigrationCountsValidator>;
type LegacyMapping = Readonly<{
  historicalKey: "id-kurikulum-merdeka" | "snbt-2026";
  programId: Doc<"learningPrograms">["_id"];
}>;

/** Complete bounded user and derived state validated before one write. */
export interface ProgramMigrationState {
  readonly coverage: readonly Doc<"learningProgramCoverage">[];
  readonly items: readonly Doc<"learningPlanItems">[];
  readonly plans: readonly Doc<"learningPlans">[];
  readonly profiles: readonly Doc<"learningProfiles">[];
  readonly programsById: ReadonlyMap<string, LearningProgram>;
}

/** Ensures every requested state count is safe for one bounded audit. */
function validateExpectedCounts(expected: ExpectedCounts) {
  for (const key of ["coverage", "items", "plans", "profiles"] as const) {
    const count = expected[key];
    if (
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count > STATE_LIMITS[key]
    ) {
      return migrationFail(
        "LEARNING_PROGRAM_MIGRATION_LIMIT",
        `${key} expected count must be between 0 and ${STATE_LIMITS[key]}.`
      );
    }
  }
  return Effect.void;
}

/** Resolves one old Convex ID through the reviewed migration mapping. */
function resolveProgram(
  programsById: ReadonlyMap<string, LearningProgram>,
  programId: string
) {
  const program = programsById.get(programId);
  return program
    ? Effect.succeed(program)
    : migrationFail(
        "LEARNING_PROGRAM_MIGRATION_MAPPING",
        `Program ID ${programId} has no reviewed stable-key mapping.`
      );
}

/** Ensures a persisted optional key agrees with its reviewed source mapping. */
function verifyStoredKey(
  storedKey: string | undefined,
  program: LearningProgram
) {
  return storedKey === undefined || storedKey === program.key
    ? Effect.void
    : migrationFail(
        "LEARNING_PROGRAM_MIGRATION_CONFLICT",
        `Stored program key ${storedKey} conflicts with ${program.key}.`
      );
}

/** Loads exact bounded state and validates every relationship and mapping. */
export const loadProgramState = Effect.fn("learningPrograms.loadProgramState")(
  function* (
    ctx: MutationCtx,
    expected: ExpectedCounts,
    programsById: ReadonlyMap<string, LearningProgram>,
    legacyMappings: readonly LegacyMapping[]
  ) {
    yield* validateExpectedCounts(expected);
    const [coverage, profiles, plans, items] = yield* Effect.all([
      Effect.promise(() =>
        ctx.db.query("learningProgramCoverage").take(STATE_LIMITS.coverage + 1)
      ),
      Effect.promise(() =>
        ctx.db.query("learningProfiles").take(STATE_LIMITS.profiles + 1)
      ),
      Effect.promise(() =>
        ctx.db.query("learningPlans").take(STATE_LIMITS.plans + 1)
      ),
      Effect.promise(() =>
        ctx.db.query("learningPlanItems").take(STATE_LIMITS.items + 1)
      ),
    ]);
    const found = {
      coverage: coverage.length,
      items: items.length,
      plans: plans.length,
      profiles: profiles.length,
    };
    if (
      found.coverage !== expected.coverage ||
      found.items !== expected.items ||
      found.plans !== expected.plans ||
      found.profiles !== expected.profiles
    ) {
      return yield* migrationFail(
        "LEARNING_PROGRAM_MIGRATION_COUNT",
        `State expected ${expected.coverage}/${expected.profiles}/${expected.plans}/${expected.items} coverage/profile/plan/item rows but found ${found.coverage}/${found.profiles}/${found.plans}/${found.items}.`
      );
    }

    const profilesById = new Map(
      profiles.map((profile) => [profile._id, profile])
    );
    const plansById = new Map(plans.map((plan) => [plan._id, plan]));
    const legacyIds = new Set(
      legacyMappings.map((mapping) => mapping.programId)
    );
    const usedProgramIds = new Set<string>();

    for (const profile of profiles) {
      const program = yield* resolveProgram(programsById, profile.programId);
      usedProgramIds.add(profile.programId);
      yield* verifyStoredKey(profile.programKey, program);
      if (
        !profile.interests.some((interest) =>
          LEARNING_INTEREST_PROGRAM_KIND_MATCHES[interest].some(
            (kind) => kind === program.kind
          )
        )
      ) {
        return yield* migrationFail(
          "LEARNING_PROGRAM_MIGRATION_RELATION",
          `Profile ${profile._id} interests conflict with ${program.key}.`
        );
      }
    }

    for (const plan of plans) {
      const profile = profilesById.get(plan.profileId);
      const program = yield* resolveProgram(programsById, plan.programId);
      usedProgramIds.add(plan.programId);
      yield* verifyStoredKey(plan.programKey, program);
      const profileProgram = profile
        ? yield* resolveProgram(programsById, profile.programId)
        : null;
      if (
        !profile ||
        profile.userId !== plan.userId ||
        (plan.status === "active" &&
          (profile.activePlanId !== plan._id ||
            profileProgram?.key !== program.key))
      ) {
        return yield* migrationFail(
          "LEARNING_PROGRAM_MIGRATION_RELATION",
          `Plan ${plan._id} lost its profile or stable program relation.`
        );
      }
    }

    for (const profile of profiles) {
      if (!profile.activePlanId) {
        continue;
      }
      const plan = plansById.get(profile.activePlanId);
      if (
        plan?.status !== "active" ||
        plan.profileId !== profile._id ||
        plan.userId !== profile.userId
      ) {
        return yield* migrationFail(
          "LEARNING_PROGRAM_MIGRATION_RELATION",
          `Profile ${profile._id} has an invalid active plan.`
        );
      }
    }

    for (const item of items) {
      const plan = plansById.get(item.planId);
      const program = yield* resolveProgram(programsById, item.programId);
      usedProgramIds.add(item.programId);
      yield* verifyStoredKey(item.programKey, program);
      if (
        legacyIds.has(item.programId) ||
        !plan ||
        legacyIds.has(plan.programId) ||
        plan.userId !== item.userId ||
        (yield* resolveProgram(programsById, plan.programId)).key !==
          program.key
      ) {
        return yield* migrationFail(
          "LEARNING_PROGRAM_MIGRATION_RELATION",
          `Plan item ${item._id} lost its current plan/program relation.`
        );
      }
    }

    for (const row of coverage) {
      const program = yield* resolveProgram(programsById, row.programId);
      usedProgramIds.add(row.programId);
      yield* verifyStoredKey(row.programKey, program);
      if (legacyIds.has(row.programId)) {
        return yield* migrationFail(
          "LEARNING_PROGRAM_MIGRATION_RELATION",
          `Coverage ${row._id} references a retired program ID.`
        );
      }
    }

    if (
      legacyMappings.some((mapping) => !usedProgramIds.has(mapping.programId))
    ) {
      return yield* migrationFail(
        "LEARNING_PROGRAM_MIGRATION_MAPPING",
        "At least one historical ID mapping is unused by persisted state."
      );
    }
    return { coverage, items, plans, profiles, programsById };
  }
);
