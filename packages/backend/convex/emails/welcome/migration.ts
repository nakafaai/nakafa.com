import type { EmailStatus } from "@convex-dev/resend";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { resend } from "@repo/backend/convex/emails/client";
import { tryWelcomeIntent } from "@repo/backend/convex/emails/welcome/impl";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect, Result } from "effect";

const LEGACY_WELCOME_HANDLE_PAGE_SIZE = 32;
const LEGACY_WELCOME_HANDLE_PAGE_BYTES = 4 * 1024 * 1024;
const legacyWelcomeMigrationMaxPagesValidator = literals(
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8
);
const migrationCountFields = {
  cancelledHandles: v.number(),
  clearedHandles: v.number(),
  componentRecordsMissing: v.number(),
  inspectedHandles: v.number(),
  inspectionFailures: v.number(),
  scannedUsers: v.number(),
};

export const legacyWelcomeHandleMigrationResultValidator = v.union(
  v.object({
    ...migrationCountFields,
    continueCursor: v.null(),
    isDone: v.literal(true),
  }),
  v.object({
    ...migrationCountFields,
    continueCursor: v.string(),
    isDone: v.literal(false),
  })
);

export type LegacyWelcomeHandleMigrationResult = Infer<
  typeof legacyWelcomeHandleMigrationResultValidator
>;

type LegacyWelcomeHandleMigrationCounts = Omit<
  LegacyWelcomeHandleMigrationResult,
  "continueCursor" | "isDone"
>;
type MigrationPageRunner = (
  cursor: string | null
) => Promise<LegacyWelcomeHandleMigrationResult>;

const migrateLegacyWelcomeHandlePageReference = makeFunctionReference<
  "mutation",
  { cursor: string | null },
  LegacyWelcomeHandleMigrationResult
>("emails/welcome/migration:migrateLegacyWelcomeHandlePage");

export function legacyWelcomePageOptions(cursor: string | null) {
  return {
    cursor,
    maximumBytesRead: LEGACY_WELCOME_HANDLE_PAGE_BYTES,
    maximumRowsRead: LEGACY_WELCOME_HANDLE_PAGE_SIZE,
    numItems: LEGACY_WELCOME_HANDLE_PAGE_SIZE,
  } as const;
}

function emptyMigrationCounts(): LegacyWelcomeHandleMigrationCounts {
  return {
    cancelledHandles: 0,
    clearedHandles: 0,
    componentRecordsMissing: 0,
    inspectedHandles: 0,
    inspectionFailures: 0,
    scannedUsers: 0,
  };
}

function addMigrationCounts(
  left: LegacyWelcomeHandleMigrationCounts,
  right: LegacyWelcomeHandleMigrationCounts
): LegacyWelcomeHandleMigrationCounts {
  return {
    cancelledHandles: left.cancelledHandles + right.cancelledHandles,
    clearedHandles: left.clearedHandles + right.clearedHandles,
    componentRecordsMissing:
      left.componentRecordsMissing + right.componentRecordsMissing,
    inspectedHandles: left.inspectedHandles + right.inspectedHandles,
    inspectionFailures: left.inspectionFailures + right.inspectionFailures,
    scannedUsers: left.scannedUsers + right.scannedUsers,
  };
}

function isCancelableLegacyEmail(status: EmailStatus | null) {
  return status?.status === "waiting" || status?.status === "queued";
}

/** Clears one legacy handle only after its component state was safely inspected. */
const clearLegacyWelcomeHandle = Effect.fn(
  "emails.welcome.migration.clearLegacyHandle"
)(function* (ctx: MutationCtx, user: Doc<"users">) {
  if (!user.welcomeEmailId) {
    return emptyMigrationCounts();
  }
  const legacyHandle = user.welcomeEmailId;

  const statusResult = yield* Effect.result(
    tryWelcomeIntent(() => resend.status(ctx, legacyHandle))
  );
  if (Result.isFailure(statusResult)) {
    return {
      ...emptyMigrationCounts(),
      inspectionFailures: 1,
    } satisfies LegacyWelcomeHandleMigrationCounts;
  }

  const status = statusResult.success;
  const shouldCancel = isCancelableLegacyEmail(status);
  if (shouldCancel) {
    yield* tryWelcomeIntent(() => resend.cancelEmail(ctx, legacyHandle));
  }

  yield* tryWelcomeIntent(() =>
    ctx.db.patch(user._id, { welcomeEmailId: undefined })
  );

  return {
    ...emptyMigrationCounts(),
    cancelledHandles: shouldCancel ? 1 : 0,
    clearedHandles: 1,
    componentRecordsMissing: status === null ? 1 : 0,
    inspectedHandles: 1,
  } satisfies LegacyWelcomeHandleMigrationCounts;
});

/** Scans and clears one bounded user page inside one app/component transaction. */
const migrateLegacyWelcomeHandlePageProgram = Effect.fn(
  "emails.welcome.migration.page"
)(function* (ctx: MutationCtx, cursor: string | null) {
  const page = yield* tryWelcomeIntent(() =>
    ctx.db.query("users").paginate(legacyWelcomePageOptions(cursor))
  );
  let counts: LegacyWelcomeHandleMigrationCounts = {
    ...emptyMigrationCounts(),
    scannedUsers: page.page.length,
  };

  for (const user of page.page) {
    counts = addMigrationCounts(
      counts,
      yield* clearLegacyWelcomeHandle(ctx, user)
    );
  }

  if (page.isDone) {
    return {
      ...counts,
      continueCursor: null,
      isDone: true,
    } satisfies LegacyWelcomeHandleMigrationResult;
  }

  return {
    ...counts,
    continueCursor: page.continueCursor,
    isDone: false,
  } satisfies LegacyWelcomeHandleMigrationResult;
});

/** Runs only the caller-approved number of bounded pages and returns no row data. */
const migrateLegacyWelcomeHandlesProgram = Effect.fn(
  "emails.welcome.migration.run"
)(function* (
  runPage: MigrationPageRunner,
  cursor: string | null,
  maxPages: Infer<typeof legacyWelcomeMigrationMaxPagesValidator>
) {
  const firstPage = yield* tryWelcomeIntent(() => runPage(cursor));
  let counts = addMigrationCounts(emptyMigrationCounts(), firstPage);
  if (firstPage.isDone) {
    return {
      ...counts,
      continueCursor: null,
      isDone: true,
    } satisfies LegacyWelcomeHandleMigrationResult;
  }
  let nextCursor = firstPage.continueCursor;

  for (let pageIndex = 1; pageIndex < maxPages; pageIndex += 1) {
    const page = yield* tryWelcomeIntent(() => runPage(nextCursor));
    counts = addMigrationCounts(counts, page);
    if (page.isDone) {
      return {
        ...counts,
        continueCursor: null,
        isDone: true,
      } satisfies LegacyWelcomeHandleMigrationResult;
    }
    nextCursor = page.continueCursor;
  }

  return {
    ...counts,
    continueCursor: nextCursor,
    isDone: false,
  } satisfies LegacyWelcomeHandleMigrationResult;
});

/** Temporary rollout mutation for one transactionally isolated migration page. */
export const migrateLegacyWelcomeHandlePage = internalMutation({
  args: { cursor: v.union(v.null(), v.string()) },
  returns: legacyWelcomeHandleMigrationResultValidator,
  handler: (ctx, { cursor }) =>
    runConvexProgram(migrateLegacyWelcomeHandlePageProgram(ctx, cursor)),
});

/** Temporary bounded orchestrator; rerun with its cursor until the second clean pass. */
export const migrateLegacyWelcomeHandles = internalAction({
  args: {
    cursor: v.union(v.null(), v.string()),
    maxPages: legacyWelcomeMigrationMaxPagesValidator,
  },
  returns: legacyWelcomeHandleMigrationResultValidator,
  handler: (ctx: ActionCtx, { cursor, maxPages }) =>
    runConvexProgram(
      migrateLegacyWelcomeHandlesProgram(
        (pageCursor) =>
          ctx.runMutation(migrateLegacyWelcomeHandlePageReference, {
            cursor: pageCursor,
          }),
        cursor,
        maxPages
      )
    ),
});
