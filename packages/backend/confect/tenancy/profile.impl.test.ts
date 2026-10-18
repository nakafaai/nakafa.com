import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { schoolMascot } from "@repo/backend/confect/tenancy/mascot";
import { storageUrl, storeFile } from "@repo/backend/test/logo";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const profile = refs.public.tenancy.profile.get;

describe("tenancy/profile", () => {
  it.effect(
    "shows a school's public identity and its animal to anyone, signed in or not",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const expected = {
          kind: "school",
          mascot: schoolMascot(fixture.tenants.other),
          name: "Sekolah Lain",
          slug: "other",
          status: "active",
        };
        expect(
          yield* fixture.anonymous.query(profile, { slug: slugOf("other") })
        ).toEqual(expected);
        expect(
          yield* fixture.as("owner").query(profile, { slug: slugOf("other") })
        ).toEqual(expected);
      })
  );

  it.effect(
    "shows the address of the logo that a school holds, beside its animal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const logo = yield* storeFile(
          fixture.convex,
          new Blob(["logo"], { type: "image/png" })
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenants").patch(fixture.tenants.other, { logo })
          )
        );
        const shown = yield* fixture.anonymous.query(profile, {
          slug: slugOf("other"),
        });
        expect(shown).toEqual({
          kind: "school",
          logo: yield* storageUrl(fixture.convex, logo),
          mascot: schoolMascot(fixture.tenants.other),
          name: "Sekolah Lain",
          slug: "other",
          status: "active",
        });
      })
  );

  it.effect("fails with a typed not-found for an unknown address", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const missing = yield* fixture.anonymous
        .query(profile, { slug: slugOf("missing") })
        .pipe(Effect.flip);
      expect(missing).toMatchObject({
        _tag: "TenantNotFound",
        code: "TENANT_NOT_FOUND",
        message: "No school has this address.",
      });
    })
  );
});
