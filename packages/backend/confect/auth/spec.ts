import { failureWire } from "@repo/backend/confect/failure";
import { Schema, SchemaTransformation } from "effect";
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
export const AccountUnavailableWire = failureWire(AccountUnavailable);
const SessionRequiredWire = SessionRequired.fields.message.pipe(
  Schema.decodeTo(
    SessionRequired,
    SchemaTransformation.transform({
      decode: (message) => ({
        _tag: SessionRequired.fields._tag.schema.literal,
        code: SessionRequired.fields.code.literal,
        message,
      }),
      encode: ({ message }) => message,
    })
  )
);
export const AuthReadErrorWire = failureWire(AuthReadError);

/** Authentication failures retain their established transport payloads. */
export const AuthFailure = Schema.Union([
  SessionRequiredWire,
  AccountUnavailableWire,
  AuthReadErrorWire,
]);
export type AuthFailure = typeof AuthFailure.Type;
