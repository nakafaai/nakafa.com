import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect, Schema } from "effect";

export const programMigrationTableValidator = literals(
  "coverage",
  "items",
  "plans",
  "profiles"
);

export const historicalProgramKeyValidator = literals(
  "id-kurikulum-merdeka",
  "snbt-2026"
);

export const programMigrationCountsValidator = v.object({
  coverage: v.number(),
  items: v.number(),
  plans: v.number(),
  profiles: v.number(),
  programs: v.number(),
  sources: v.number(),
});

export const programIdentityMigrationArgsValidator = v.object({
  apply: v.boolean(),
  expected: programMigrationCountsValidator,
  expectedMissing: v.number(),
  legacyMappings: v.array(
    v.object({
      historicalKey: historicalProgramKeyValidator,
      programId: v.id("learningPrograms"),
    })
  ),
  snapshotId: v.string(),
  table: programMigrationTableValidator,
});

export const programIdentityMigrationResultValidator = v.object({
  missing: v.number(),
  remaining: v.number(),
  total: v.number(),
  updated: v.number(),
});

/** A program identity rollout invariant failed before a guarded write. */
export class ProgramMigrationError extends Schema.TaggedError<ProgramMigrationError>()(
  "ProgramMigrationError",
  {
    code: Schema.String,
    message: Schema.String,
  }
) {}

/** Fails one migration program with a stable Convex error payload. */
export function migrationFail(code: string, message: string) {
  return Effect.fail(new ProgramMigrationError({ code, message }));
}

/** Resolves a reviewed historical identity to its current stable key. */
export function resolveHistoricalProgramKey(
  historicalKey: "id-kurikulum-merdeka" | "snbt-2026"
) {
  if (historicalKey === "id-kurikulum-merdeka") {
    return LearningProgramKeySchema.make("merdeka");
  }
  return LearningProgramKeySchema.make("snbt");
}
