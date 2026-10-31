import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { schoolMascot } from "@repo/backend/confect/tenancy/mascot";
import { storageUrl, storeFile } from "@repo/backend/test/logo";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Option } from "effect";

const profile = refs.public.tenancy.profile.get;

describe("tenancy/profile", () => {
  it.effect(
    "shows a school's public identity and its animal to anyone, signed in or not",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const expected = {
          kind: "school",
          mascot: schoolMascot("other"),
          name: "Sekolah Lain",
          slug: "other",
          status: "active",
        };
        expect(
          yield* fixture.anonymous.query(profile, { slug: slugOf("other") })
        ).toEqual(Option.some(expected));
        expect(
          yield* fixture.as("owner").query(profile, { slug: slugOf("other") })
        ).toEqual(Option.some(expected));
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
        expect(shown).toEqual(
          Option.some({
            kind: "school",
            logo: yield* storageUrl(fixture.convex, logo),
            mascot: schoolMascot("other"),
            name: "Sekolah Lain",
            slug: "other",
            status: "active",
          })
        );
      })
  );

  it.effect(
    "answers none for an address that no school uses, so a probe of a random School host fails nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        expect(
          yield* fixture.anonymous.query(profile, { slug: slugOf("missing") })
        ).toEqual(Option.none());
      })
  );
});

const refusal = refs.public.tenancy.profile.refusal;

describe("tenancy/profile refusal", () => {
  it.effect(
    "refuses a school that no one has the address of, and admits one that exists",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        expect(
          yield* fixture.anonymous.query(refusal, { slug: slugOf("missing") })
        ).toBe(true);
        expect(
          yield* fixture.anonymous.query(refusal, { slug: slugOf("nf") })
        ).toBe(false);
      })
  );
});
