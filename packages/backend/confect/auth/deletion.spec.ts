import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

export const accountDeletionUnavailableCode =
  "ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE";

/**
 * The deletion cannot start, because this deployment could not erase the account from PostHog:
 * a deleted account leaves PostHog too, so nothing of it is deleted first.
 */
export class AccountDeletionUnavailable extends Schema.TaggedError<
  AccountDeletionUnavailable,
  { readonly brand: unique symbol }
>()("AccountDeletionUnavailable", {
  code: Schema.Literal(accountDeletionUnavailableCode),
  message: Schema.Literal("Account deletion is temporarily unavailable."),
}) {}

/** The signed-in person deletes their own account (`deletion/request`). */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "deleteAccount",
    returns: () => Schema.Null,
    error: () => Schema.Union([AuthFailure, AccountDeletionUnavailable]),
  })
    .middleware(Session)
    .middleware(Atomic)
);
