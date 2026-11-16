import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  claimForAddress,
  claimGuardianPersons,
} from "@repo/backend/confect/guardians/claim";
import { LINK_TERM } from "@repo/backend/confect/guardians/schema";
import { loginAddress } from "@repo/backend/confect/identity/address";
import {
  asStaffSchool,
  IBU,
  signInGuardian,
  startLink,
} from "@repo/backend/test/guardians";
import {
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** The account state of the guardian Person a link names. */
const guardianAccount = (
  fixture: Fixture,
  linkId: Effect.Success<ReturnType<typeof startLink>>["id"]
) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const link = yield* reader.table("guardianLinks").get(linkId);
      const guardian = yield* reader
        .table("tenantPeople")
        .get(link.guardianPersonId);
      return guardian.account;
    })
  );

describe("guardians/claim", () => {
  it.effect(
    "binds the guardian Person to the account at its Google sign-in, and journals the claim",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const link = yield* startLink(fixture);
        expect(yield* guardianAccount(fixture, link.id)).toEqual({
          state: "unclaimed",
        });
        const guardian = yield* signInGuardian(fixture);
        expect(yield* guardianAccount(fixture, link.id)).toMatchObject({
          method: "address",
          state: "claimed",
          userId: guardian.userId,
        });
        expect(Arr.last(yield* fixture.run(journal))).toMatchObject({
          _tag: "Some",
          value: { change: { method: "address", type: "person.claimed" } },
        });
        // A second sign-in finds the Person claimed and leaves it as it is.
        const before = yield* fixture.run(journal);
        yield* fixture.run(claimGuardianPersons(guardian.userId, IBU));
        expect(yield* fixture.run(journal)).toEqual(before);
      })
  );

  it.effect(
    "claims at once for an account that already holds the address when the school links it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const guardian = yield* fixture.account("ibu", IBU);
        const link = yield* startLink(fixture);
        expect(yield* guardianAccount(fixture, link.id)).toMatchObject({
          state: "claimed",
          userId: guardian.userId,
        });
      })
  );

  it.effect(
    "claims nothing for a deleted account, a school account, or a link that has ended",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const guardian = yield* fixture.account("ibu", IBU);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("users")
              .patch(guardian.userId, { deletedAt: TENANCY_NOW })
          )
        );
        const link = yield* startLink(fixture);
        yield* fixture.run(claimForAddress(IBU));
        expect(yield* guardianAccount(fixture, link.id)).toEqual({
          state: "unclaimed",
        });
        // A school account has no mailbox, so its placeholder address claims nothing.
        yield* fixture.run(
          claimGuardianPersons(guardian.userId, loginAddress("ibu-card"))
        );
        expect(yield* guardianAccount(fixture, link.id)).toEqual({
          state: "unclaimed",
        });
        // Past its term an unverified link no longer stands.
        vi.setSystemTime(TENANCY_NOW + Duration.toMillis(LINK_TERM) + 1);
        const fresh = yield* fixture.account("ibu-baru", IBU);
        yield* fixture.internal.mutation(
          refs.internal.auth.account.signInGoogle,
          {
            method: {
              name: "google",
              profile: { email: IBU, emailVerified: true, id: "google-ibu" },
            },
            userId: fresh.userId,
          }
        );
        expect(yield* guardianAccount(fixture, link.id)).toEqual({
          state: "unclaimed",
        });
      })
  );
});
