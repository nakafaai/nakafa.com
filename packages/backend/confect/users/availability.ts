import type { UsersDoc } from "@repo/backend/confect/_generated/docs";
import type { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getAppUserByUsername } from "@repo/backend/confect/users/directory";
import { isReservedUsername } from "@repo/backend/confect/users/reserved";
import {
  readUsername,
  type UsernameRefusal,
} from "@repo/backend/confect/users/username";
import { Effect, Result } from "effect";

/**
 * Settles whether an account may take a username. The text must be allowed,
 * must not be a route or a name that could pass for Nakafa, and must not
 * belong to another account. `owner` is the account that asks, which keeps its
 * own username. The answer is the username as it is stored, or the first
 * reason it cannot be taken.
 */
export const inspectUsername = Effect.fn("users.availability.inspect")(
  function* (
    input: string,
    owner?: UsersDoc["_id"]
  ): Effect.fn.Return<
    Result.Result<string, typeof UsernameRefusal.Type>,
    never,
    DatabaseReader
  > {
    const username = readUsername(input);
    if (Result.isFailure(username)) {
      return username;
    }
    if (isReservedUsername(username.success)) {
      return Result.fail("notAllowed");
    }
    const holder = yield* getAppUserByUsername(username.success);
    return holder === null || holder._id === owner
      ? username
      : Result.fail("taken");
  }
);
