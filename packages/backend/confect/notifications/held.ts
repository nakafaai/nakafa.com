import type { GenericId } from "@confect/core";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Effect } from "effect";

/**
 * The most active member Persons one inbox request reads for its account. ADR
 * 0011 sets no limit on the tenants of an account, so this bound is the owner's
 * number to set; it is one indexed read, and a request never reads more.
 */
const HELD_SCHOOL_LIMIT = 100;

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
 * The active member Persons the account holds, across its schools, in one
 * indexed read. A claimed Person names its account, so the account's Persons are
 * one range of the index.
 */
export const heldPersons = Effect.fn("notifications.held.persons")(function* (
  userId: GenericId.GenericId<"users">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .index("by_account_userId_and_kind_and_status", (query) =>
      query
        .eq("account.userId", userId)
        .eq("kind", "member")
        .eq("status", "active")
    )
    .take(HELD_SCHOOL_LIMIT)
    .pipe(Effect.orDie);
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
