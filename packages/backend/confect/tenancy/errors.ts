import { Effect, Schema } from "effect";

/** A stable code and a message a screen may show, each with its default. */
const refusal = <const Code extends string>(code: Code, message: string) => ({
  code: Schema.Literal(code).pipe(
    Schema.withConstructorDefault(Effect.succeed(code))
  ),
  message: Schema.String.pipe(
    Schema.withConstructorDefault(Effect.succeed(message))
  ),
});

const tenantNotFound = Schema.Literal("TENANT_NOT_FOUND");

/** No tenant has this address. */
export class TenantNotFound extends Schema.TaggedError<TenantNotFound>()(
  "TenantNotFound",
  {
    code: tenantNotFound.pipe(
      Schema.withConstructorDefault(Effect.succeed(tenantNotFound.literal))
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("No school has this address.")
      )
    ),
  }
) {}

/**
 * An organisation that Nakafa refuses to open: `SLUG_TAKEN` another tenant has
 * the address, `SLUG_RESERVED` the address belongs to Nakafa itself,
 * `UNIT_REQUIRED` no school was named, `UNIT_LIMIT` more schools than one
 * organisation holds.
 */
export class ProvisionRejected extends Schema.TaggedError<ProvisionRejected>()(
  "ProvisionRejected",
  {
    code: Schema.Literals([
      "SLUG_TAKEN",
      "SLUG_RESERVED",
      "UNIT_REQUIRED",
      "UNIT_LIMIT",
    ]),
    message: Schema.String,
  }
) {}

/** A period whose dates are not calendar dates of its school's clock, or whose start is not before its end. */
export class PeriodDatesInvalid extends Schema.TaggedError<PeriodDatesInvalid>()(
  "PeriodDatesInvalid",
  refusal(
    "PERIOD_DATES_INVALID",
    "The period needs two calendar dates, and it must start before it ends."
  )
) {}

/** A period that shares a day with another period of its school. */
export class PeriodOverlaps extends Schema.TaggedError<PeriodOverlaps>()(
  "PeriodOverlaps",
  refusal(
    "PERIOD_OVERLAPS",
    "This period shares a day with another period of this school."
  )
) {}

/** Opening a period while another period of its school is active. */
export class PeriodActive extends Schema.TaggedError<PeriodActive>()(
  "PeriodActive",
  refusal(
    "PERIOD_ACTIVE",
    "Another period of this school is active. Archive it first."
  )
) {}

/** Archiving a period that is not active. */
export class PeriodNotActive extends Schema.TaggedError<PeriodNotActive>()(
  "PeriodNotActive",
  refusal("PERIOD_NOT_ACTIVE", "Only an active period can be archived.")
) {}

/** A cohort name that another cohort of its period already uses, compared without case. */
export class CohortNameTaken extends Schema.TaggedError<CohortNameTaken>()(
  "CohortNameTaken",
  refusal("COHORT_NAME_TAKEN", "Another cohort of this period has this name.")
) {}

/** Creating a cohort in a period that holds the most cohorts it can. */
export class CohortLimit extends Schema.TaggedError<CohortLimit>()(
  "CohortLimit",
  refusal("COHORT_LIMIT", "This period holds the most cohorts it can.")
) {}

/** Placing a Person in a cohort of a period where the Person already has one. */
export class PersonAlreadyPlaced extends Schema.TaggedError<PersonAlreadyPlaced>()(
  "PersonAlreadyPlaced",
  refusal(
    "PERSON_ALREADY_PLACED",
    "This person already has a cohort in this period."
  )
) {}

/** Moving a Person who has no cohort in the period of the target cohort. */
export class PersonNotPlaced extends Schema.TaggedError<PersonNotPlaced>()(
  "PersonNotPlaced",
  refusal(
    "PERSON_NOT_PLACED",
    "This person has no cohort in this period to move."
  )
) {}

/** Placing a Person who already holds the most cohort placements the school allows. */
export class PersonPlacementLimit extends Schema.TaggedError<PersonPlacementLimit>()(
  "PersonPlacementLimit",
  refusal(
    "PERSON_PLACEMENT_LIMIT",
    "This person holds the most cohort placements they can."
  )
) {}

/** Inviting a Person who already has an account. */
export class PersonClaimed extends Schema.TaggedError<PersonClaimed>()(
  "PersonClaimed",
  refusal("PERSON_CLAIMED", "This person already has an account.")
) {}

/** An invite to an address on a domain that the school's allowed email domains do not admit. */
export class InviteDomainRefused extends Schema.TaggedError<InviteDomainRefused>()(
  "InviteDomainRefused",
  refusal(
    "INVITE_DOMAIN_REFUSED",
    "This school does not admit this email domain."
  )
) {}

/** Inviting a Person who already has a pending invite. */
export class InvitePending extends Schema.TaggedError<InvitePending>()(
  "InvitePending",
  refusal("INVITE_PENDING", "This person already has a pending invite.")
) {}

/** Sending again an invite that is no longer waiting for a claim. */
export class InviteNotPending extends Schema.TaggedError<InviteNotPending>()(
  "InviteNotPending",
  refusal(
    "INVITE_NOT_PENDING",
    "This invite is no longer waiting to be claimed."
  )
) {}

/** Sending again an invite that has expired. */
export class InviteExpired extends Schema.TaggedError<InviteExpired>()(
  "InviteExpired",
  refusal("INVITE_EXPIRED", "This invite has expired. Invite the person again.")
) {}

/** Sending an invite again more often than the school may. */
export class InviteRateLimited extends Schema.TaggedError<InviteRateLimited>()(
  "InviteRateLimited",
  refusal(
    "INVITE_RATE_LIMITED",
    "This invite was sent too often. Try again later."
  )
) {}
