import type { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Contract } from "@repo/backend/confect/tenancy/contract";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

const open = refs.internal.tenancy.provision.open;
const invite = refs.internal.tenancy.provision.invite;
const contract: typeof Contract.Type = {
  contentLicense: "1.0",
  dpaVersion: "2026-10",
  modules: ["classes", "exams"],
  plan: "tenant",
};
const address = Schema.decodeSync(Email)("kepala@harapan.example.test");
const stranger = Schema.decodeSync(Email)("lain@harapan.example.test");

/** A school that opens with one school unit and an Owner at `address`. */
const openSchool = (slug: string): Ref.Args<typeof open> => ({
  contract,
  country: "ID",
  currency: "IDR",
  kind: "school",
  name: "SMA Harapan Bangsa",
  owner: { email: address, name: "Kepala Sekolah" },
  slug: slugOf(slug),
  units: [
    {
      contentLanguage: "id",
      level: "sma",
      name: "SMA Harapan Bangsa",
      timeZone: "Asia/Jakarta",
    },
  ],
});

describe("tenancy invite into a school", () => {
  it.effect(
    "invites a new Person into an existing school, pending for the address",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const opened = yield* fixture.internal.mutation(
          open,
          openSchool("harapan")
        );
        const invited = yield* fixture.internal.mutation(invite, {
          email: stranger,
          locale: "id",
          name: "Siswa Harapan",
          slug: slugOf("harapan"),
        });
        const stored = yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            return {
              invite: yield* reader.table("tenantInvites").get(invited.invite),
              person: yield* reader.table("tenantPeople").get(invited.person),
            };
          })
        );
        expect(stored.person).toMatchObject({
          account: { state: "unclaimed" },
          kind: "member",
          status: "active",
          tenantId: opened.tenant,
        });
        expect(stored.invite).toMatchObject({
          channel: { email: stranger, kind: "email" },
          personId: invited.person,
          state: { status: "pending" },
        });
      })
  );

  it.effect("refuses an address that no school uses", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const missing = yield* fixture.internal
        .mutation(invite, {
          email: stranger,
          locale: "id",
          name: "Siswa Harapan",
          slug: slugOf("missing"),
        })
        .pipe(Effect.flip);
      expect(missing).toMatchObject({
        _tag: "ProvisionRejected",
        code: "SCHOOL_NOT_FOUND",
      });
    })
  );
});
