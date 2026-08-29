import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  FIRST_MODEL_TABLE,
  MODEL_MIGRATION_PAGE_BYTES,
  MODEL_MIGRATION_PAGE_ROWS,
  type ModelMigrationCycle,
  type ModelMigrationReceipt,
} from "@repo/backend/convex/contentRelease/models/migration/spec";
import {
  ensureModelMigration,
  stableModelState,
  validateModelMigrationState,
} from "@repo/backend/convex/contentRelease/models/migration/state";
import type { ModelMigrationTable } from "@repo/backend/convex/contentRelease/models/schema";
import { INITIAL_MODEL_SLOT } from "@repo/backend/convex/contentRelease/models/slot";
import { Effect } from "effect";

/** Returns the next bounded read-model table in dependency-free order. */
function nextModelTable(
  table: ModelMigrationTable
): ModelMigrationTable | null {
  if (table === "articleCatalog") {
    return "articleCategories";
  }
  if (table === "articleCategories") {
    return "articleBuckets";
  }
  if (table === "articleBuckets") {
    return "materialCatalog";
  }
  if (table === "materialCatalog") {
    return "materialBuckets";
  }
  if (table === "materialBuckets") {
    return "contentIndex";
  }
  return null;
}

/** Reads one bounded table page without relying on the new slot indexes. */
function readModelPage(
  ctx: MutationCtx,
  table: ModelMigrationTable,
  cursor: string | undefined
) {
  const options = {
    cursor: cursor ?? null,
    maximumBytesRead: MODEL_MIGRATION_PAGE_BYTES,
    maximumRowsRead: MODEL_MIGRATION_PAGE_ROWS,
    numItems: MODEL_MIGRATION_PAGE_ROWS,
  };
  if (table === "articleCatalog") {
    return Effect.promise(() => ctx.db.query(table).paginate(options));
  }
  if (table === "articleCategories") {
    return Effect.promise(() => ctx.db.query(table).paginate(options));
  }
  if (table === "articleBuckets") {
    return Effect.promise(() => ctx.db.query(table).paginate(options));
  }
  if (table === "materialCatalog") {
    return Effect.promise(() => ctx.db.query(table).paginate(options));
  }
  if (table === "materialBuckets") {
    return Effect.promise(() => ctx.db.query(table).paginate(options));
  }
  return Effect.promise(() => ctx.db.query("contentIndex").paginate(options));
}

/** Backfills one bounded page while rejecting any conflicting buffer value. */
const backfillModelPage = Effect.fn("contentRelease.backfillModelSlot")(
  function* (ctx: MutationCtx, migration: ModelMigrationCycle) {
    const page = yield* readModelPage(ctx, migration.table, migration.cursor);
    for (const row of page.page) {
      if (row.slot !== undefined && row.slot !== INITIAL_MODEL_SLOT) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Read-model table ${migration.table} contains a conflicting slot.`
        );
      }
      if (row.slot === undefined) {
        yield* Effect.promise(() =>
          ctx.db.patch(row._id, { slot: INITIAL_MODEL_SLOT })
        );
      }
    }
    return page;
  }
);

/** Proves one bounded page contains only the canonical initial buffer. */
const verifyModelPage = Effect.fn("contentRelease.verifyModelSlot")(function* (
  ctx: MutationCtx,
  migration: ModelMigrationCycle
) {
  const page = yield* readModelPage(ctx, migration.table, migration.cursor);
  if (page.page.some((row) => row.slot !== INITIAL_MODEL_SLOT)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Read-model table ${migration.table} failed slot verification.`
    );
  }
  return page;
});

/** Advances one completed table or atomically publishes migrated slot state. */
const advanceModelMigration = Effect.fn("contentRelease.advanceModelMigration")(
  function* (
    ctx: MutationCtx,
    state: Doc<"contentState">,
    migration: ModelMigrationCycle,
    scannedRows: number
  ) {
    const table = nextModelTable(migration.table);
    const now = Date.now();
    if (table) {
      yield* Effect.promise(() =>
        ctx.db.patch("contentModelMigrations", migration._id, {
          cursor: undefined,
          scannedRows,
          table,
          updatedAt: now,
        })
      );
      return {
        complete: false,
        phase: migration.phase,
        scannedRows,
        table,
      } satisfies ModelMigrationReceipt;
    }
    if (migration.phase === "backfill") {
      yield* Effect.promise(() =>
        ctx.db.patch("contentModelMigrations", migration._id, {
          cursor: undefined,
          phase: "verify",
          scannedRows,
          table: FIRST_MODEL_TABLE,
          updatedAt: now,
        })
      );
      return {
        complete: false,
        phase: "verify" as const,
        scannedRows,
        table: FIRST_MODEL_TABLE,
      } satisfies ModelMigrationReceipt;
    }
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, {
        articleSlot: INITIAL_MODEL_SLOT,
        materialSlot: INITIAL_MODEL_SLOT,
        searchSlot: INITIAL_MODEL_SLOT,
        updatedAt: now,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch("contentModelMigrations", migration._id, {
        cursor: undefined,
        phase: "complete",
        scannedRows,
        updatedAt: now,
      })
    );
    return {
      complete: true,
      phase: "complete" as const,
      scannedRows,
      table: migration.table,
    } satisfies ModelMigrationReceipt;
  }
);

/** Runs one transactional, resumable backfill or verification page. */
export const migrateModelPage = Effect.fn("contentRelease.migrateModelPage")(
  function* (ctx: MutationCtx) {
    const stable = yield* stableModelState(ctx);
    const migration = yield* ensureModelMigration(ctx, stable);
    yield* validateModelMigrationState(stable, migration);
    if (migration.phase === "complete") {
      return {
        complete: true,
        phase: migration.phase,
        scannedRows: migration.scannedRows,
        table: migration.table,
      } satisfies ModelMigrationReceipt;
    }
    const result =
      migration.phase === "backfill"
        ? yield* backfillModelPage(ctx, migration)
        : yield* verifyModelPage(ctx, migration);
    const scannedRows = migration.scannedRows + result.page.length;
    if (result.isDone) {
      return yield* advanceModelMigration(
        ctx,
        stable.state,
        migration,
        scannedRows
      );
    }
    yield* Effect.promise(() =>
      ctx.db.patch("contentModelMigrations", migration._id, {
        cursor: result.continueCursor,
        scannedRows,
        updatedAt: Date.now(),
      })
    );
    return {
      complete: false,
      phase: migration.phase,
      scannedRows,
      table: migration.table,
    } satisfies ModelMigrationReceipt;
  }
);
