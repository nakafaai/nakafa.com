import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/**
 * Temporary maintenance function. Better Auth now encrypts the provider access
 * and refresh tokens it stores (`account.encryptOAuthTokens`), but rows written
 * before that change still hold them as plain text.
 *
 * One call reads one page of `account` rows, starting at `cursor`, and rewrites
 * each plain access or refresh token the way Better Auth stores it: with its
 * own `setTokenUtil` and the auth secret of this deployment. A token that
 * Better Auth already reads as encrypted is left alone, so a second run cannot
 * encrypt twice. A token that looks encrypted but cannot be decrypted with the
 * current secret is left alone and counted in `unreadable`. The id token is not
 * touched, because Better Auth stores it as issued.
 *
 * It runs on dev and on production. Call it with `continueCursor` until
 * `isDone`, then once more from `null`: `encrypted` and `unreadable` must both
 * be zero. This module, its implementation, and its tests are then deleted.
 *
 * It lives in the app and not in the Better Auth component, because a Convex
 * component cannot read the app's environment, and the auth secret must be the
 * one Better Auth itself resolves.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "encryptStoredTokens",
    args: () => ({
      cursor: Schema.Union([Schema.Null, Schema.String]),
    }),
    returns: () =>
      Schema.Struct({
        continueCursor: Schema.String,
        encrypted: Count,
        isDone: Schema.Boolean,
        scanned: Count,
        unreadable: Count,
      }),
  })
);
