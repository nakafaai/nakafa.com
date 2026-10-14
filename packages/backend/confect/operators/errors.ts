import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** The account is not an active Nakafa operator, so an operator command refuses it. */
export class NotOperator extends Schema.TaggedError<NotOperator>()(
  "NotOperator",
  refusal("NOT_OPERATOR", "Only an active Nakafa operator may do this.")
) {}

/** The school is suspended, so an operator may not ask it for a visit. */
export class TenantSuspended extends Schema.TaggedError<TenantSuspended>()(
  "TenantSuspended",
  refusal(
    "TENANT_SUSPENDED",
    "This school is suspended, so it takes no visits until it is reactivated."
  )
) {}

/** The operator already has a requested or approved visit to this school. */
export class VisitOpen extends Schema.TaggedError<VisitOpen>()(
  "VisitOpen",
  refusal(
    "VISIT_OPEN",
    "This operator already has an open visit to this school."
  )
) {}

/** A visit the school has already answered, or that is not requested at all. */
export class VisitNotPending extends Schema.TaggedError<VisitNotPending>()(
  "VisitNotPending",
  refusal(
    "VISIT_NOT_PENDING",
    "Only a requested visit can be approved or declined."
  )
) {}

/** Ending a visit that the school never approved. */
export class VisitNotApproved extends Schema.TaggedError<VisitNotApproved>()(
  "VisitNotApproved",
  refusal("VISIT_NOT_APPROVED", "Only an approved visit can be ended.")
) {}

/** Replacing the Owners of a school that a signed-in Owner holds. */
export class OwnerClaimed extends Schema.TaggedError<OwnerClaimed>()(
  "OwnerClaimed",
  refusal(
    "OWNER_CLAIMED",
    "This school has a signed-in Owner, so its Owners cannot be replaced."
  )
) {}

/** Approving an operator who already holds a person of another kind in the school. */
export class OperatorHasPerson extends Schema.TaggedError<OperatorHasPerson>()(
  "OperatorHasPerson",
  refusal(
    "OPERATOR_HAS_PERSON",
    "This operator already holds a person in this school."
  )
) {}

/** Granting operator access to an account ID that names no account. */
export class AccountNotFound extends Schema.TaggedError<AccountNotFound>()(
  "AccountNotFound",
  refusal("ACCOUNT_NOT_FOUND", "No account has this ID.")
) {}
