import { FunctionSpec, GroupSpec } from "@confect/core";
import { publicFailure } from "@repo/backend/confect/failure";
import { Schema } from "effect";

/**
 * The deployment sets no Better Auth secret. Better Auth would then seal under
 * a default secret that its source publishes.
 */
export class AuthSecretMissing extends Schema.TaggedError<AuthSecretMissing>()(
  "AuthSecretMissing",
  {
    code: Schema.Literal("AUTH_SECRET_MISSING"),
    message: Schema.String,
  }
) {}

/**
 * Temporary maintenance function. Better Auth now seals the provider access
 * and refresh tokens it stores (`account.encryptOAuthTokens`), but account rows
 * written before that change still hold them as plain text.
 *
 * One call reads one page of `account` rows, starting at `cursor`, and seals
 * each plain access or refresh token the way Better Auth does at sign-in: with
 * its own `setTokenUtil` and the auth secret of this deployment. A token that
 * Better Auth already reads as encrypted is left alone, so a second run cannot
 * encrypt twice. A token that looks encrypted but cannot be decrypted with the
 * secrets of this deployment, such as one sealed with a secret version that was
 * retired, is left alone and listed in `unreadable` with its row, its column,
 * and the reason Better Auth gave. The ID token is not touched, because Better
 * Auth stores it as issued. `encrypted` and `scanned` count rows.
 *
 * It fails with `AuthSecretMissing`, before it writes anything, when the
 * deployment sets none of `BETTER_AUTH_SECRETS`, `BETTER_AUTH_SECRET`, and
 * `AUTH_SECRET`.
 *
 * Run it on dev and on production, calling it again with `continueCursor`
 * until `isDone`. Then run a second full pass: every page must report
 * `encrypted` as zero and `unreadable` as empty. This function, its
 * implementation, and its tests are then deleted.
 *
 * It lives in the app and not in the Better Auth component, because the
 * component receives no environment variables: its config declares none and
 * the app forwards none, so only the app can read the secret that Better Auth
 * seals with. The app also builds Better Auth's own context from the same
 * options, so the option and the secret resolve exactly as they do at sign-in.
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
        encrypted: Schema.Finite,
        isDone: Schema.Boolean,
        scanned: Schema.Finite,
        unreadable: Schema.Array(
          Schema.Struct({
            account: Schema.String,
            field: Schema.Literals(["accessToken", "refreshToken"]),
            reason: Schema.String,
          })
        ),
      }),
    error: () => publicFailure(AuthSecretMissing),
  })
);
