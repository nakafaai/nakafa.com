import { Schema } from "effect";
export const accountUnavailableCode = "UNAUTHORIZED";
export const accountUnavailableMessage = "User not found.";

/** A session exists but the app account cannot accept this operation. */
export class AccountUnavailable extends Schema.TaggedError<AccountUnavailable>()(
  "AccountUnavailable",
  {
    code: Schema.Literal(accountUnavailableCode),
    message: Schema.String,
  }
) {}

/** Better Auth could not establish a current session. */
export class SessionRequired extends Schema.TaggedError<SessionRequired>()(
  "SessionRequired",
  {
    code: Schema.Literal("UNAUTHENTICATED"),
    message: Schema.Literal("Unauthenticated"),
  }
) {}

/** Authentication storage or its component could not be read. */
export class AuthReadError extends Schema.TaggedError<AuthReadError>()(
  "AuthReadError",
  {
    code: Schema.Literal("AUTH_READ_FAILED"),
    message: Schema.Literal("Unable to read authentication state."),
  }
) {}
export const AuthFailure = Schema.Union([
  SessionRequired,
  AccountUnavailable,
  AuthReadError,
]);
export type AuthFailure = typeof AuthFailure.Type;
