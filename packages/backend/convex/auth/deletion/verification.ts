import { components } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { FunctionReturnType } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

type VerificationPage = FunctionReturnType<
  typeof components.betterAuth.deletion.deleteUserVerificationPage
>;
type DeleteVerificationPage = (
  cursor: string | null
) => Promise<VerificationPage>;

/** Drains every bounded verification scan page for one deleted auth user. */
export const drainDeletedUserVerificationsProgram: (
  deletePage: DeleteVerificationPage
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "auth.deletion.drainDeletedUserVerifications"
)(function* (deletePage: DeleteVerificationPage) {
  let cursor: string | null = null;

  while (true) {
    const page = yield* tryUserCleanup(() => deletePage(cursor));

    if (page.isDone) {
      return;
    }

    cursor = page.continueCursor;
  }
});

/**
 * Removes direct verification tokens and in-flight OAuth-link state after the
 * Better Auth user is gone. Workflow retry safely restarts the bounded scan.
 */
export const drainDeletedUserVerifications = internalAction({
  args: {
    authId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      drainDeletedUserVerificationsProgram((cursor) =>
        ctx.runMutation(
          components.betterAuth.deletion.deleteUserVerificationPage,
          {
            authId: args.authId,
            cursor,
          }
        )
      )
    );

    return null;
  },
});
