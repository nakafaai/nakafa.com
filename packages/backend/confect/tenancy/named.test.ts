import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { members } = refs.public.tenancy.roster;
const { list: grants } = refs.public.access.grants;
const firstPage = { paginationOpts: { cursor: null, numItems: 100 } };

describe("tenancy/named", () => {
  it.effect(
    "finds a member by name past every page, and leaves out a removed person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const admin = fixture.as("admin");
        const search = { ...firstPage, search: "Teach", slug: nf };
        const found = yield* admin.query(members, search);
        expect(Arr.map(found.page, (row) => row.name)).toEqual(["Teacher"]);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenantPeople")
              .patch(fixture.people.teacher.personId, { status: "removed" })
          )
        );
        expect((yield* admin.query(members, search)).page).toEqual([]);
      })
  );

  it.effect("finds the grants of the people a search names", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const found = yield* fixture
        .as("admin")
        .query(grants, { ...firstPage, search: "Teach", slug: nf });
      expect(Arr.map(found.page, (row) => row.id)).toEqual([
        fixture.people.teacher.grantId,
      ]);
    })
  );
});
