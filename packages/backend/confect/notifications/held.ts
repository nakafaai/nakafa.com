import type { GenericId } from "@confect/core";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { NotificationScopeTooLarge } from "@repo/backend/confect/notifications/errors";
import { Effect } from "effect";

/**
 * The most Persons, and so the most schools, that one inbox request reads for its
 * account. An account holds at most one Person in a school: claiming a Person
 * refuses an account that already holds one there (`confect/tenancy/claims.impl.ts`).
 * So this bound is the number of schools one request reads, and each read of them
 * is one indexed `take`. An account over the bound is refused, so no answer shows
 * some of its rows and not others.
 */
export const HELD_SCHOOL_LIMIT = 100;

/**
 * Whether the account holds this Person: an active member Person that the
 * account has claimed. A released or removed Person names no account, and an
 * operator Person is never a school member.
 */
export const holds = (
  person: TenantPeopleDoc,
  userId: GenericId.GenericId<"users">
) =>
  person.kind === "member" &&
  person.status === "active" &&
  person.account.state === "claimed" &&
  person.account.userId === userId;

/**
 * The active member Persons the account holds, across its schools, in one bounded
 * read. A claimed Person names its account, so the account's Persons are one range
 * of the index. One read past the limit tells an account over the limit apart.
 */
export const heldPersons = Effect.fn("notifications.held.persons")(function* (
  userId: GenericId.GenericId<"users">
) {
  const persons = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .index("by_account_userId_and_kind_and_status", (query) =>
      query
        .eq("account.userId", userId)
        .eq("kind", "member")
        .eq("status", "active")
    )
    .take(HELD_SCHOOL_LIMIT + 1)
    .pipe(Effect.orDie);
  if (persons.length > HELD_SCHOOL_LIMIT) {
    return yield* new NotificationScopeTooLarge();
  }
  return persons;
});

/** One Person the account holds, with the school it belongs to. */
export type HeldSchool = Effect.Success<ReturnType<typeof heldSchools>>[number];

/** The Persons the account holds, each with the school it belongs to. */
export const heldSchools = Effect.fn("notifications.held.schools")(function* (
  userId: GenericId.GenericId<"users">
) {
  const reader = yield* DatabaseReader;
  const persons = yield* heldPersons(userId);
  return yield* Effect.forEach(
    persons,
    (person) =>
      reader
        .table("tenants")
        .get(person.tenantId)
        .pipe(
          Effect.orDie,
          Effect.map((tenant) => ({ person, tenant }))
        ),
    { concurrency: "unbounded" }
  );
});
