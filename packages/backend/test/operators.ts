import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Option } from "effect";

/** The fixture the tenancy tests seed, once its effect has run. */
type Fixture = Effect.Success<typeof tenancyFixture>;

/**
 * Seeds one Nakafa operator: a verified account with an active operator row, and
 * a client signed in as it, the way the console calls the operator commands.
 */
export const operatorAccount = Effect.fn("test.operators.account")(function* (
  fixture: Fixture,
  suffix: string
) {
  const account = yield* fixture.account(
    suffix,
    `${suffix}@nakafa.example.test`,
    true
  );
  yield* fixture.internal.mutation(refs.internal.operators.staff.grant, {
    userId: account.userId,
  });
  return account;
});

/** Writes the operator row of one account, as Nakafa staff grant it, at `now`. */
export const operatorRow = Effect.fn("test.operators.row")(function* (
  userId: GenericId.GenericId<"users">,
  now: number
) {
  return yield* (yield* DatabaseWriter).table("operators").insert({
    changedAt: now,
    grantedAt: now,
    status: "active",
    userId,
  });
});

/** The Person a school holds for one account, read on the account index. */
export const personOf = Effect.fn("test.operators.person")(function* (
  fixture: Fixture,
  userId: GenericId.GenericId<"users">
) {
  const found = yield* fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("tenantPeople")
        .index("by_tenantId_and_account_userId", (query) =>
          query.eq("tenantId", fixture.tenants.nf).eq("account.userId", userId)
        )
        .first()
        .pipe(Effect.orDie)
    )
  );
  return yield* Option.match(found, {
    onNone: () => Effect.die("The operator holds no person."),
    onSome: Effect.succeed,
  });
});

/** The active grants one Person holds. */
export const grantsOf = Effect.fn("test.operators.grants")(function* (
  fixture: Fixture,
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("tenantGrants")
        .index("by_personId_and_status", (query) =>
          query.eq("personId", personId).eq("status", "active")
        )
        .take(10)
        .pipe(Effect.orDie)
    )
  );
});
