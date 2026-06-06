import { createCollisionUsername } from "@repo/backend/convex/auth/username/policy";
import type { DBAdapter } from "better-auth/types";
import { Effect, Schema } from "effect";

const USERNAME_COLLISION_ATTEMPTS = 32;

/** Signals that every bounded generated username candidate was already taken. */
export class GeneratedUsernameExhaustedError extends Schema.TaggedError<GeneratedUsernameExhaustedError>()(
  "GeneratedUsernameExhaustedError",
  {
    message: Schema.String,
    username: Schema.String,
  }
) {}

/** Signals that Better Auth's adapter failed while checking username availability. */
export class GeneratedUsernameLookupError extends Schema.TaggedError<GeneratedUsernameLookupError>()(
  "GeneratedUsernameLookupError",
  {
    cause: Schema.optional(Schema.String),
    message: Schema.String,
    username: Schema.String,
  }
) {}

interface UniqueGeneratedUsernameInput {
  displayUsername: string;
  email: string;
  username: string;
  usernameExists: (
    username: string
  ) => Effect.Effect<boolean, GeneratedUsernameLookupError>;
}

/** Finds the first generated username that is not already stored. */
export const resolveUniqueGeneratedUsername = Effect.fn(
  "auth.username.resolveUniqueGeneratedUsername"
)(function* (input: UniqueGeneratedUsernameInput) {
  if (!(yield* input.usernameExists(input.username))) {
    return input.username;
  }

  for (let attempt = 1; attempt <= USERNAME_COLLISION_ATTEMPTS; attempt += 1) {
    const username = createCollisionUsername(
      input.username,
      input.email,
      input.displayUsername,
      attempt
    );

    if (!(yield* input.usernameExists(username))) {
      return username;
    }
  }

  return yield* Effect.fail(
    new GeneratedUsernameExhaustedError({
      message: "Unable to create a unique generated username",
      username: input.username,
    })
  );
});

/**
 * Builds an Effect lookup against Better Auth's current adapter.
 *
 * We do not provide a caller-side generic to `findOne` because the adapter owns
 * the selected return shape.
 *
 * Sources:
 * - DBAdapter contract:
 *   @better-auth/core@1.6.12/src/db/adapter/index.ts
 * - Convex adapter implementation:
 *   @convex-dev/better-auth@0.12.2/src/client/adapter.ts
 */
export function createUsernameExists(adapter: DBAdapter) {
  return (username: string) =>
    Effect.tryPromise({
      try: () =>
        adapter.findOne({
          model: "user",
          select: ["username"],
          where: [
            {
              field: "username",
              value: username,
            },
          ],
        }),
      catch: (error) =>
        new GeneratedUsernameLookupError({
          cause: getErrorMessage(error),
          message: "Unable to check generated username availability",
          username,
        }),
    }).pipe(Effect.map(Boolean));
}

/** Returns one string from unknown thrown values without losing safety. */
function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return;
}
