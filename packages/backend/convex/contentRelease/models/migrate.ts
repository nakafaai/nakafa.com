import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { migrateModelPage } from "@repo/backend/convex/contentRelease/models/migration/page";
import {
  FIRST_MODEL_TABLE,
  MODEL_MIGRATION_RUN_PAGES,
  type ModelMigrationReceipt,
  modelMigrationReceiptValidator,
  modelMigrationStatusValidator,
} from "@repo/backend/convex/contentRelease/models/migration/spec";
import {
  acceptModelMigration,
  loadModelMigration,
} from "@repo/backend/convex/contentRelease/models/migration/state";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const pageReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  ModelMigrationReceipt
>("contentRelease/models/migrate:page");

/** Drains bounded transactions and remains safely resumable after interruption. */
const runModelMigration = Effect.fn("contentRelease.runModelMigration")(
  function* (ctx: ActionCtx) {
    let latest: ModelMigrationReceipt = {
      complete: false,
      phase: "backfill",
      scannedRows: 0,
      table: FIRST_MODEL_TABLE,
    };
    for (let index = 0; index < MODEL_MIGRATION_RUN_PAGES; index += 1) {
      latest = yield* callInternal(() => ctx.runMutation(pageReference, {}));
      if (latest.complete) {
        return latest;
      }
    }
    return latest;
  }
);

/** Internal bounded page invoked only through Convex admin orchestration. */
export const page = internalMutation({
  args: {},
  returns: modelMigrationReceiptValidator,
  handler: (ctx) => runConvexProgram(migrateModelPage(ctx)),
});

/** Internal resumable runner invoked through authenticated Convex admin access. */
export const run = internalAction({
  args: {},
  returns: modelMigrationReceiptValidator,
  handler: (ctx) => runConvexProgram(runModelMigration(ctx)),
});

/** Internal status proof for the current one-time migration cycle. */
export const status = internalQuery({
  args: {},
  returns: modelMigrationStatusValidator,
  handler: (ctx) =>
    runConvexProgram(
      Effect.gen(function* () {
        const migration = yield* loadModelMigration(ctx);
        if (!migration) {
          return { phase: "absent" as const };
        }
        return {
          complete: migration.phase === "complete",
          phase: migration.phase,
          scannedRows: migration.scannedRows,
          table: migration.table,
        };
      })
    ),
});

/** Internal terminal acceptance after explicit production proof. */
export const accept = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) => runConvexProgram(acceptModelMigration(ctx)),
});
