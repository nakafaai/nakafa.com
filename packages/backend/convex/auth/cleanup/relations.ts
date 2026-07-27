import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import type { Where } from "better-auth";
import { Effect, Schema } from "effect";

const authRelationCleanupFailedCode = "AUTH_RELATION_CLEANUP_FAILED";

type DeleteAuthRows = (input: {
  model: string;
  where: Where[];
}) => Promise<number>;

interface DeletedAuthUser {
  readonly email: string;
  readonly id: string;
}

/** Raised when Better Auth cannot remove a user-owned relation before deletion. */
export class AuthRelationCleanupError extends Schema.TaggedError<AuthRelationCleanupError>()(
  "AuthRelationCleanupError",
  {
    code: Schema.Literal(authRelationCleanupFailedCode),
    message: Schema.String,
  }
) {}

/**
 * Deletes Better Auth plugin rows that are not covered by core user deletion.
 * Running before the auth user is removed keeps relation cleanup fail-closed.
 */
export const cleanupAuthRelations = Effect.fn(
  "auth.cleanup.cleanupAuthRelations"
)(function* (deleteRows: DeleteAuthRows, user: DeletedAuthUser) {
  const relations = [
    {
      model: "member",
      where: [{ field: "userId", value: user.id }],
    },
    {
      model: "invitation",
      where: [{ field: "inviterId", value: user.id }],
    },
    {
      model: "invitation",
      where: [{ field: "email", value: user.email }],
    },
    {
      model: "verification",
      where: [{ field: "identifier", value: user.email }],
    },
  ] satisfies Array<{ model: string; where: Where[] }>;

  for (const relation of relations) {
    yield* Effect.tryPromise({
      try: () => deleteRows(relation),
      catch: (error) =>
        new AuthRelationCleanupError({
          code: authRelationCleanupFailedCode,
          message: `Failed to delete ${relation.model} auth rows: ${getUnknownErrorMessage(error)}`,
        }),
    });
  }
});
