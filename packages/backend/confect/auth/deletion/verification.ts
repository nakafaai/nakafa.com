import type { components } from "@repo/backend/confect/_generated/components";
import type { UserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
export type VerificationPage = FunctionReturnType<
  typeof components.betterAuth.deletion.deleteUserVerificationPage
>;
export type DeleteVerificationPage = (
  cursor: string | null
) => Effect.Effect<VerificationPage, UserCleanupError>;
export type LoadVerificationCursor = Effect.Effect<
  string | null,
  UserCleanupError
>;
export type SaveVerificationCursor = (
  cursor: string | null
) => Effect.Effect<unknown, UserCleanupError>;
/**
 * Drains every bounded verification scan page and checkpoints after each page
 * so an interrupted action resumes instead of rescanning the global prefix.
 */
export const drainDeletedUserVerificationsProgram = Effect.fn(
  "auth.deletion.drainDeletedUserVerifications"
)(function* (operations: {
  readonly deletePage: DeleteVerificationPage;
  readonly loadCursor: LoadVerificationCursor;
  readonly saveCursor: SaveVerificationCursor;
}) {
  let cursor = yield* operations.loadCursor;
  while (true) {
    const page = yield* operations.deletePage(cursor);
    if (page.isDone) {
      yield* operations.saveCursor(null);
      return;
    }
    cursor = page.continueCursor;
    yield* operations.saveCursor(cursor);
  }
});
