import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const profile = refs.public.tenancy.profile.get;

describe("tenancy/profile", () => {
  it.effect(
    "shows a school's public identity to anyone, signed in or not",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const expected = {
          kind: "school",
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
