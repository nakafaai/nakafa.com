import { components } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { type FunctionReturnType, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

type VerificationPage = FunctionReturnType<
  typeof components.betterAuth.deletion.deleteUserVerificationPage
>;
type DeleteVerificationPage = (
  cursor: string | null
) => Promise<VerificationPage>;
type LoadVerificationCursor = () => Promise<string | null>;
type SaveVerificationCursor = (cursor: string | null) => Promise<unknown>;
interface VerificationCleanupOperations {
  readonly deletePage: DeleteVerificationPage;
  readonly loadCursor: LoadVerificationCursor;
  readonly saveCursor: SaveVerificationCursor;
}

const loadVerificationCursorReference = makeFunctionReference<
  "query",
  { userId: Id<"users"> },
  string | null
>("auth/deletion/verification:loadDeletedUserVerificationCursor");
const saveVerificationCursorReference = makeFunctionReference<
  "mutation",
  {
    cursor: string | null;
    userId: Id<"users">;
  },
  null
>("auth/deletion/verification:saveDeletedUserVerificationCursor");

/**
 * Drains every bounded verification scan page and checkpoints after each page
 * so an interrupted action resumes instead of rescanning the global prefix.
 */
export const drainDeletedUserVerificationsProgram: (
  operations: VerificationCleanupOperations
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "auth.deletion.drainDeletedUserVerifications"
)(function* (operations: VerificationCleanupOperations) {
  let cursor = yield* tryUserCleanup(operations.loadCursor);

  while (true) {
    const page = yield* tryUserCleanup(() => operations.deletePage(cursor));

    if (page.isDone) {
      yield* tryUserCleanup(() => operations.saveCursor(null));
      return;
    }

    cursor = page.continueCursor;
    yield* tryUserCleanup(() => operations.saveCursor(cursor));
  }
});

/** Loads the durable cursor owned by the retained deleted-user tombstone. */
export const loadDeletedUserVerificationCursor = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    return user?.authVerificationCleanupCursor ?? null;
  },
});

/** Persists one completed component page for workflow retry continuity. */
export const saveDeletedUserVerificationCursor = internalMutation({
  args: {
    cursor: v.union(v.null(), v.string()),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);

    if (!user || user.deletedAt === undefined) {
      return null;
    }

    await ctx.db.patch("users", user._id, {
      authVerificationCleanupCursor: args.cursor ?? undefined,
    });
    return null;
  },
});

/**
 * Removes direct verification tokens and in-flight OAuth-link state after the
 * Better Auth user is gone. Workflow retry safely restarts the bounded scan.
 */
export const drainDeletedUserVerifications = internalAction({
  args: {
    authId: v.string(),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      drainDeletedUserVerificationsProgram({
        deletePage: (cursor) =>
          ctx.runMutation(
            components.betterAuth.deletion.deleteUserVerificationPage,
            {
              authId: args.authId,
              cursor,
            }
          ),
        loadCursor: () =>
          ctx.runQuery(loadVerificationCursorReference, {
            userId: args.userId,
          }),
        saveCursor: (cursor) =>
          ctx.runMutation(saveVerificationCursorReference, {
            cursor,
            userId: args.userId,
          }),
      })
    );

    return null;
  },
});
