import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { createTenancyFixture } from "@repo/backend/test/tenancy";

const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

describe("tenancy/memberships", () => {
  it("lists only the caller's own active member Persons", async () => {
    const fixture = await createTenancyFixture();
    const owner = await fixture
      .as("owner")
      .query(api.tenancy.memberships.list, firstPage);
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
    const other = await fixture
      .as("otherOwner")
      .query(api.tenancy.memberships.list, firstPage);
    expect(other.page.map((item) => item.tenant.slug)).toEqual(["other"]);
  });

  it("hides suspended and operator Persons and accounts without a school", async () => {
    const fixture = await createTenancyFixture();
    for (const account of ["suspended", "visitor", "stranger"] as const) {
      const result = await fixture
        .as(account)
        .query(api.tenancy.memberships.list, firstPage);
      expect(result.page).toEqual([]);
    }
  });

  it("requires a session", async () => {
    const fixture = await createTenancyFixture();
    await expect(
      fixture.t.query(api.tenancy.memberships.list, firstPage)
    ).rejects.toMatchObject({
      data: { _tag: "SessionRequired", code: "UNAUTHENTICATED" },
    });
  });
});
