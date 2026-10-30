import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { SCHOOL_FREE_STUDENTS } from "@repo/backend/confect/billing/catalog";
import type { SittingFixture } from "@repo/backend/test/sittings";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

/** An account that no school has invited, signed in with a personal Google address. */
export const newcomer = (fixture: SittingFixture, suffix: string) =>
  fixture.account(suffix, `${suffix}@gmail.example.test`, true, null);

/** The Person that an account holds in the test school, with its active grants. */
export const personOf = (
  fixture: SittingFixture,
  userId: GenericId.GenericId<"users">
) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const person = yield* reader
        .table("tenantPeople")
        .index("by_tenantId_and_account_userId", (query) =>
          query.eq("tenantId", fixture.tenants.nf).eq("account.userId", userId)
        )
        .first();
      const grants = yield* Effect.forEach(Arr.fromOption(person), (found) =>
        reader
          .table("tenantGrants")
          .index("by_personId_and_status", (query) =>
            query.eq("personId", found._id).eq("status", "active")
          )
          .collect()
      );
      return { grants: Arr.flatten(grants), person: Option.getOrNull(person) };
    })
  );

/** A member Person of the test school claimed by the account, holding the given student units. */
export const seedMember = (
  fixture: SittingFixture,
  userId: GenericId.GenericId<"users">,
  units: readonly GenericId.GenericId<"tenantUnits">[]
) =>
  fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const personId = yield* writer.table("tenantPeople").insert({
        account: {
          claimedAt: TENANCY_NOW,
          method: "invite",
          state: "claimed",
          userId,
        },
        kind: "member",
        name: "Siswa Lain",
        status: "active",
        tenantId: fixture.tenants.nf,
      });
      yield* Effect.forEach(units, (unitId) =>
        writer.table("tenantGrants").insert({
          grantedBy: { kind: "system" },
          personId,
          role: { key: "student", kind: "builtin" },
          scope: { kind: "unit", unitId },
          status: "active",
          tenantId: fixture.tenants.nf,
          term: { kind: "standing" },
        })
      );
      return personId;
    })
  );

/** Fills the free plan's student seats of the test school, which holds one student already. */
export const fillSeats = (fixture: SittingFixture) =>
  fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      yield* Effect.forEach(Arr.range(2, SCHOOL_FREE_STUDENTS), (n) =>
        writer
          .table("tenantPeople")
          .insert({
            account: { state: "unclaimed" },
            kind: "member",
            name: `Siswa ${n}`,
            status: "active",
            tenantId: fixture.tenants.nf,
          })
          .pipe(
            Effect.flatMap((personId) =>
              writer.table("tenantGrants").insert({
                grantedBy: { kind: "system" },
                personId,
                role: { key: "student", kind: "builtin" },
                scope: { kind: "unit", unitId: fixture.units.smp },
                status: "active",
                tenantId: fixture.tenants.nf,
                term: { kind: "standing" },
              })
            )
          )
      );
    })
  );
