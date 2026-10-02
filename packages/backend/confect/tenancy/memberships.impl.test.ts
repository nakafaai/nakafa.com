import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const memberships = refs.public.tenancy.memberships.list;
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

describe("tenancy/memberships", () => {
  it.effect("lists only the caller's own active member Persons", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = yield* fixture.as("owner").query(memberships, firstPage);
      expect(owner.page).toEqual([
        {
          person: { id: fixture.people.owner.personId, name: "Owner" },
          tenant: {
            kind: "foundation",
            name: "Yayasan Nakafa",
            slug: "nf",
            status: "active",
          },
        },
      ]);
      const other = yield* fixture
        .as("otherOwner")
        .query(memberships, firstPage);
      expect(Arr.map(other.page, (item) => item.tenant.slug)).toEqual([
        "other",
      ]);
    })
  );

  it.effect(
    "hides suspended and operator Persons and accounts without a school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const pages = yield* Effect.forEach(
          ["suspended", "visitor", "stranger"] as const,
          (account) => fixture.as(account).query(memberships, firstPage)
        );
        expect(Arr.map(pages, (result) => result.page)).toEqual([[], [], []]);
      })
  );

  it.effect("requires a session", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denial = yield* fixture.anonymous
        .query(memberships, firstPage)
        .pipe(Effect.flip);
      expect(denial).toMatchObject({
        _tag: "SessionRequired",
        code: "UNAUTHENTICATED",
      });
    })
  );
});
