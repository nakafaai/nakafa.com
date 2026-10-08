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
export type VerificationCleanupOperations = Parameters<
  typeof drainDeletedUserVerificationsProgram
>;
/**
 * Drains every bounded verification scan page and checkpoints after each page
 * so an interrupted action resumes instead of rescanning the global prefix.
 */
export const drainDeletedUserVerificationsProgram: (
  deletePage: DeleteVerificationPage,
  loadCursor: LoadVerificationCursor,
  saveCursor: SaveVerificationCursor
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "auth.deletion.drainDeletedUserVerifications"
)(function* (
  deletePage: DeleteVerificationPage,
  loadCursor: LoadVerificationCursor,
  saveCursor: SaveVerificationCursor
) {
  let cursor = yield* loadCursor;
  while (true) {
    const page = yield* deletePage(cursor);
    if (page.isDone) {
      yield* saveCursor(null);
      return;
    }
    cursor = page.continueCursor;
    yield* saveCursor(cursor);
  }
});
