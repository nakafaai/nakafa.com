import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import { nf } from "@repo/backend/test/classroom";
import { grantRole, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

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
    grantRole(fixture.tenants.nf, fixture.people.counselor.personId, "staff", {
      kind: "tenant",
    })
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
export const setRoster = (fixture: Fixture, nisn: typeof Nisn.Type) =>
  fixture.as("counselor").mutation(refs.public.roster.entries.set, {
    nisn,
    personId: fixture.people.student.personId,
    slug: nf,
  });

/**
 * Signs the guardian in with Google: seeds an account that holds the address,
 * whose sign-in claims the guardian Persons a live link of that address names
 * (ADR 0034), and answers its client.
 */
export const signInGuardian = Effect.fn("test.guardians.signIn")(function* (
  fixture: Fixture
) {
  const account = yield* fixture.account("ibu", IBU);
  yield* fixture.internal.mutation(refs.internal.auth.account.signInGoogle, {
    method: {
      name: "google",
      profile: { email: IBU, emailVerified: true, id: "google-ibu" },
    },
    userId: account.userId,
  });
  return account;
});

/** The guardian link of one ID, read straight from the table. */
export const linkRow = (
  fixture: Fixture,
  linkId: GenericId.GenericId<"guardianLinks">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("guardianLinks").get(linkId).pipe(Effect.orDie)
    )
  );
