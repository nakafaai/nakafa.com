import { paginationOptsValidator } from "convex/server";
import { type Infer, v } from "convex/values";
import { Effect, Schema } from "effect";

/** Bounded arguments shared by every retry-safe migration page. */
export const tryoutMigrationArgs = {
  apply: v.boolean(),
  expectedProcessed: v.number(),
  expectedSnapshotId: v.string(),
  expectedTotal: v.number(),
  paginationOpts: paginationOptsValidator,
};
export type TryoutMigrationArgs = {
  readonly [Key in keyof typeof tryoutMigrationArgs]: Infer<
    (typeof tryoutMigrationArgs)[Key]
  >;
};

const MIGRATION_MAX_BYTES_READ = 4 * 1024 * 1024;
const MIGRATION_MAX_ROWS_READ = 64;

/** Applies server-owned scan ceilings to one operator pagination cursor. */
export function migrationPageOptions(
  paginationOpts: TryoutMigrationArgs["paginationOpts"]
) {
  return {
    ...paginationOpts,
    maximumBytesRead: MIGRATION_MAX_BYTES_READ,
    maximumRowsRead: MIGRATION_MAX_ROWS_READ,
  };
}

/** Detects a pre-existing signed identity that disagrees with its verified row. */
export function hasMigrationConflict<Value>(
  current: Value | undefined,
  expected: Value
) {
  return current !== undefined && current !== expected;
}

/** Stable operational failure emitted by the bounded try-out identity migration. */
export class TryoutMigrationError extends Schema.TaggedError<TryoutMigrationError>()(
  "TryoutMigrationError",
  {
    code: Schema.Literal("TRYOUT_MIGRATION_INVALID"),
    message: Schema.String,
  }
) {}

/** Stops a migration transaction before any partial write can commit. */
export function migrationFail(
  message: string
): Effect.Effect<never, TryoutMigrationError> {
  return Effect.fail(
    new TryoutMigrationError({
      code: "TRYOUT_MIGRATION_INVALID",
      message,
    })
  );
}

/** Rejects invalid progress and oversized transactional pages. */
export function validateMigrationPage(input: {
  readonly expectedProcessed: number;
  readonly expectedTotal: number;
  readonly numItems: number;
  readonly page: {
    readonly isDone: boolean;
    readonly page: readonly unknown[];
  };
  readonly table: string;
}): Effect.Effect<number, TryoutMigrationError> {
  if (input.numItems < 1 || input.numItems > 50) {
    return migrationFail("Try-out migration pages must contain 1 to 50 rows.");
  }

  if (
    !Number.isSafeInteger(input.expectedProcessed) ||
    input.expectedProcessed < 0 ||
    !Number.isSafeInteger(input.expectedTotal) ||
    input.expectedTotal < 0
  ) {
    return migrationFail("Try-out migration counts must be safe integers.");
  }

  const processed = input.expectedProcessed + input.page.page.length;
  const countMatches = input.page.isDone
    ? processed === input.expectedTotal
    : processed < input.expectedTotal;

  if (!countMatches) {
    return migrationFail(
      `${input.table} expected ${input.expectedTotal} rows but reached ${processed}.`
    );
  }

  return Effect.succeed(processed);
}

/** Returns only cursor and bounded mutation evidence to the operator. */
export function migrationPageResult(
  page: {
    readonly continueCursor: string;
    readonly isDone: boolean;
    readonly page: readonly unknown[];
  },
  changed: number,
  processed: number
) {
  return {
    changed,
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    processed,
    scanned: page.page.length,
  };
}
