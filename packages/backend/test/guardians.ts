import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { CODE_TERM } from "@repo/backend/confect/guardians/schema";
import { hashGuardianCode } from "@repo/backend/confect/identity/secret";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import { nf } from "@repo/backend/test/classroom";
import { grantRole, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Clock, Duration, Effect, Schema } from "effect";

/** The fixture `tenancyFixture` seeds, which the guardian tests extend. */
export type Fixture = Effect.Success<typeof tenancyFixture>;

/** The guardian address of the tests. */
export const IBU = Schema.decodeSync(Email)("ibu@example.com");

/** A student's NISN on the roster. */
export const NISN = Schema.decodeSync(Nisn)("0012345678");

/**
 * Gives the school a key and makes its counselor a Staff member (Staf TU) too, so
 * the tests act as Staff with a seeded account.
 */
export const asStaffSchool = Effect.fn("test.guardians.school")(function* (
  fixture: Fixture
) {
  yield* fixture.run(createTenantKey(fixture.tenants.nf));
  yield* fixture.run(
    grantRole(
      fixture.tenants.nf,
      fixture.people.counselor.personId,
      "staff",
      { kind: "tenant" }
    )
  );
});

/** Staff starts a link from the student to an address. */
export const startLink = (fixture: Fixture, email: typeof Email.Type = IBU) =>
  fixture.as("counselor").mutation(refs.public.guardians.links.start, {
    email,
    guardianName: "Ibu Siti",
    slug: nf,
    studentId: fixture.people.student.personId,
  });

/** Staff writes the student's roster row. */
export const setRoster = (
  fixture: Fixture,
  facts: { nisn?: typeof Nisn.Type; underAgeLimit: boolean }
) =>
  fixture.as("counselor").mutation(refs.public.roster.entries.set, {
    ...facts,
    personId: fixture.people.student.personId,
    slug: nf,
  });

/**
 * Stores a code that the test knows as the live code of an address, as `send` would,
 * so a test redeems it without reading a mail.
 */
export const knownCode = Effect.fn("test.guardians.knownCode")(function* (
  fixture: Fixture,
  code: string,
  email: typeof Email.Type = IBU,
  tries = 0
) {
  const codeHash = yield* hashGuardianCode(fixture.tenants.nf, email, code);
  const now = yield* Clock.currentTimeMillis;
  yield* fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("guardianCodes").insert({
        codeHash,
        email,
        expiresAt: now + Duration.toMillis(CODE_TERM),
        tenantId: fixture.tenants.nf,
        tries,
      })
    )
  );
});

/** Redeems a code as the sign-in endpoint does. */
export const redeem = (fixture: Fixture, code: string, email: string = IBU) =>
  fixture.internal.mutation(refs.internal.guardians.codes.redeem, {
    code,
    email,
    slug: "nf",
  });

/**
 * Signs the guardian in: seeds an account that holds the address, redeems a known
 * code, which binds the guardian Person to it, and answers its client.
 */
export const signInGuardian = Effect.fn("test.guardians.signIn")(function* (
  fixture: Fixture
) {
  const account = yield* fixture.account("ibu", IBU, true);
  yield* knownCode(fixture, "123456");
  yield* redeem(fixture, "123456");
  return account;
});

/** The guardian link of one ID, read straight from the table. */
export const linkRow = (
  fixture: Fixture,
  linkId: GenericId.GenericId<"guardianLinks">
) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("guardianLinks").get(linkId).pipe(Effect.orDie)
    )
  );
