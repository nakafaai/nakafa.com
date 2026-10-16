import type { GenericId } from "@confect/core";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Array as Arr, Effect } from "effect";


/** The active member Persons of one account read per page, so no number of schools is assumed. */
const HELD_PAGE_SIZE = 50;

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
 * Every active member Person the account holds, across its schools. A claimed
 * Person names its account, so the account's Persons are one indexed range, read
 * a page at a time until it ends.
 */
export const heldPersons = Effect.fn("notifications.held.persons")(function* (
  userId: GenericId.GenericId<"users">
) {
  const reader = yield* DatabaseReader;
  const pageAt = (
    cursor: string | null
  ): Effect.Effect<readonly TenantPeopleDoc[]> =>
    reader
      .table("tenantPeople")
      .index("by_account_userId_and_kind_and_status", (query) =>
        query
          .eq("account.userId", userId)
          .eq("kind", "member")
          .eq("status", "active")
      )
      .paginate({ cursor, numItems: HELD_PAGE_SIZE })
      .pipe(
        Effect.orDie,
        Effect.flatMap((page) =>
          page.isDone
            ? Effect.succeed(page.page)
            : Effect.map(pageAt(page.continueCursor), (rest) =>
                Arr.appendAll(page.page, rest)
              )
        )
      );
  return yield* pageAt(null);
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
