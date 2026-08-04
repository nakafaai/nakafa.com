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

/** Bounded cursor result returned by every retry-safe migration mutation. */
export const tryoutMigrationResultValidator = v.object({
  changed: v.number(),
  continueCursor: v.string(),
  isDone: v.boolean(),
  processed: v.number(),
  scanned: v.number(),
});

/** Bounded cursor evidence returned by migration integrity queries. */
export const tryoutMigrationProofValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  legacy: v.number(),
  prepared: v.number(),
  processed: v.number(),
  scanned: v.number(),
});

/** Exact proof that every unsupported technical migration table is empty. */
export const tryoutMigrationEmptyValidator = v.object({
  empty: v.literal(true),
});
export type TryoutMigrationEmpty = Infer<typeof tryoutMigrationEmptyValidator>;

const MIGRATION_MAX_BYTES_READ = 1024 * 1024;

/** Maximum hydrated records processed by one migration transaction. */
export const TRYOUT_MIGRATION_PAGE_LIMIT = 4;

/** Applies server-owned scan ceilings to one operator pagination cursor. */
export function migrationPageOptions(
  paginationOpts: TryoutMigrationArgs["paginationOpts"]
) {
  return {
    ...paginationOpts,
    maximumBytesRead: MIGRATION_MAX_BYTES_READ,
    maximumRowsRead: TRYOUT_MIGRATION_PAGE_LIMIT,
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
  if (input.numItems < 1 || input.numItems > TRYOUT_MIGRATION_PAGE_LIMIT) {
    return migrationFail(
      `Try-out migration pages must contain 1 to ${TRYOUT_MIGRATION_PAGE_LIMIT} rows.`
    );
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
    : processed <= input.expectedTotal;

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
