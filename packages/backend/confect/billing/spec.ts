import { Schema } from "effect";

/** The billing state could not be read or changed safely. */
export class BillingStateError extends Schema.TaggedError<BillingStateError>()(
  "BillingStateError",
  {
    code: Schema.Literal("BILLING_STATE_FAILED"),
    message: Schema.Literal("Unable to read or update billing state."),
  }
) {}

/** No school carries the slug an operator named, so the command has nothing to record against. */
export class TenantNotFound extends Schema.TaggedError<TenantNotFound>()(
  "TenantNotFound",
  {
    slug: Schema.String,
    message: Schema.String,
  }
) {}

/** A subscription's offer is for one kind of owner, and the account it bills names another. */
export class GrantOwnerMismatch extends Schema.TaggedError<GrantOwnerMismatch>()(
  "GrantOwnerMismatch",
  {
    message: Schema.String,
  }
) {}
