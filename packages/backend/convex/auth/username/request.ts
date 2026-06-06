import { isGeneratedUsername } from "@repo/backend/convex/auth/username/policy";
import { APIError } from "better-auth/api";
import { Effect } from "effect";

const RESERVED_USERNAME_CODE = "USERNAME_RESERVED";
const RESERVED_USERNAME_MESSAGE = "Username is reserved";

/**
 * Rejects user-provided usernames from the generated username namespace.
 *
 * Source: Better Auth hook middleware docs:
 * https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/your-first-plugin.mdx
 */
export const rejectReservedUsername = Effect.fn(
  "auth.username.rejectReservedUsername"
)(function* (body: unknown) {
  const username = getInputUsername(body);

  if (!username) {
    return;
  }

  if (!isGeneratedUsername(username)) {
    return;
  }

  return yield* Effect.fail(
    APIError.from("BAD_REQUEST", {
      code: RESERVED_USERNAME_CODE,
      message: RESERVED_USERNAME_MESSAGE,
    })
  );
});

/** Reads a username from an unknown request body. */
function getInputUsername(body: unknown) {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  if (!("username" in body)) {
    return null;
  }

  if (typeof body.username !== "string") {
    return null;
  }

  return body.username;
}
