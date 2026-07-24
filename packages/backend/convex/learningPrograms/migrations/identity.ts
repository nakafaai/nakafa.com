import type { LearningProgram } from "@nakafa/aksara-contracts/program/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { auditProgramIdentity } from "@repo/backend/convex/learningPrograms/migrations/audit";
import {
  migrationFail,
  programIdentityMigrationArgsValidator,
  programIdentityMigrationResultValidator,
} from "@repo/backend/convex/learningPrograms/migrations/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { Infer } from "convex/values";
import { Effect } from "effect";

const MIGRATION_BATCH_SIZE = 50;

interface IdentityRow {
  readonly programId: string;
  readonly programKey?: string;
}

/** Selects the requested identity table from one fully audited state. */
function selectRows(
  state: Effect.Effect.Success<ReturnType<typeof auditProgramIdentity>>,
  table: "coverage" | "items" | "plans" | "profiles"
): readonly IdentityRow[] {
  if (table === "coverage") {
    return state.coverage;
  }
  if (table === "items") {
    return state.items;
  }
  if (table === "plans") {
    return state.plans;
  }
  return state.profiles;
}

/** Patches one bounded set after every table-level invariant has passed. */
function patchRows<A extends IdentityRow>(
  rows: readonly A[],
  programsById: ReadonlyMap<string, LearningProgram>,
  patch: (row: A, programKey: string) => Promise<unknown>
) {
  return Effect.gen(function* () {
    let updated = 0;
    for (const row of rows) {
      if (row.programKey !== undefined) {
        continue;
      }
      const program = programsById.get(row.programId);
      if (!program) {
        return yield* migrationFail(
          "LEARNING_PROGRAM_MIGRATION_MAPPING",
          `Program ID ${row.programId} lost its audited mapping.`
        );
      }
      yield* Effect.promise(() => patch(row, program.key));
      updated += 1;
      if (updated === MIGRATION_BATCH_SIZE) {
        break;
      }
    }
    return updated;
  });
}

/** Writes one bounded batch to the requested physical table. */
function patchSelectedRows(
  ctx: MutationCtx,
  state: Effect.Effect.Success<ReturnType<typeof auditProgramIdentity>>,
  table: "coverage" | "items" | "plans" | "profiles"
) {
  if (table === "coverage") {
    return patchRows(state.coverage, state.programsById, (row, programKey) =>
      ctx.db.patch("learningProgramCoverage", row._id, { programKey })
    );
  }
  if (table === "items") {
    return patchRows(state.items, state.programsById, (row, programKey) =>
      ctx.db.patch("learningPlanItems", row._id, { programKey })
    );
  }
  if (table === "plans") {
    return patchRows(state.plans, state.programsById, (row, programKey) =>
      ctx.db.patch("learningPlans", row._id, { programKey })
    );
  }
  return patchRows(state.profiles, state.programsById, (row, programKey) =>
    ctx.db.patch("learningProfiles", row._id, { programKey })
  );
}

/** Audits and optionally backfills one bounded stable-program-key batch. */
const migrateIdentity = Effect.fn("learningPrograms.migrateIdentity")(
  function* (
    ctx: MutationCtx,
    args: Infer<typeof programIdentityMigrationArgsValidator>
  ) {
    const state = yield* auditProgramIdentity(
      ctx,
      args.expected,
      args.snapshotId,
      args.legacyMappings
    );
    const rows = selectRows(state, args.table);
    const missing = rows.filter((row) => row.programKey === undefined).length;

    if (
      !Number.isSafeInteger(args.expectedMissing) ||
      args.expectedMissing < 0 ||
      missing !== args.expectedMissing
    ) {
      return yield* migrationFail(
        "LEARNING_PROGRAM_MIGRATION_COUNT",
        `${args.table} expected ${args.expectedMissing} missing keys but found ${missing}.`
      );
    }

    const updated = args.apply
      ? yield* patchSelectedRows(ctx, state, args.table)
      : 0;
    return {
      missing,
      remaining: missing - updated,
      total: rows.length,
      updated,
    };
  }
);

/**
 * Audits or backfills one stable-program-key batch.
 *
 * This temporary route must be removed after dev and production are fully
 * backfilled and the strict program-key schema has deployed.
 */
export const migrateProgramIdentity = internalMutation({
  args: programIdentityMigrationArgsValidator,
  returns: programIdentityMigrationResultValidator,
  handler: (ctx, args) => runConvexProgram(migrateIdentity(ctx, args)),
});
