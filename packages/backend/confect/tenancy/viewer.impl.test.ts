import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { createTenancyFixture, slugOf } from "@repo/backend/test/tenancy";

const nf = slugOf("nf");
const notMember = { data: { _tag: "NotMember", code: "NOT_MEMBER" } };

describe("tenancy/viewer", () => {
  it("returns the Owner's tenant, active units, grants, and every tenant capability", async () => {
    const fixture = await createTenancyFixture();
    const viewer = await fixture
      .as("owner")
      .query(api.tenancy.viewer.get, { slug: nf });
    expect(viewer.tenant).toEqual({
      id: fixture.tenants.nf,
      kind: "foundation",
      name: "Yayasan Nakafa",
      slug: "nf",
      status: "active",
    });
    expect(viewer.person).toEqual({
      id: fixture.people.owner.personId,
      kind: "member",
      name: "Owner",
    });
    expect(viewer.units.map((unit) => unit.name).sort()).toEqual([
      "SMA Nakafa",
      "SMP Nakafa",
    ]);
    expect(viewer.grants).toEqual([
      {
        id: fixture.people.owner.grantId,
        role: { key: "owner", kind: "builtin" },
        scope: { kind: "tenant" },
        term: { kind: "standing" },
      },
    ]);
    expect([...viewer.can].sort()).toEqual([
      "audit.view",
      "grant.manage",
      "owner.manage",
      "tenant.manage",
      "tenant.view",
    ]);
  });

  it("gives a unit teacher the shell through membership and nothing else", async () => {
    const fixture = await createTenancyFixture();
    const viewer = await fixture
      .as("teacher")
      .query(api.tenancy.viewer.get, { slug: nf });
    expect(viewer.can).toEqual(["tenant.view"]);
  });

  it("drops every write capability while the tenant is suspended", async () => {
    const fixture = await createTenancyFixture();
    await fixture.t.run(async (ctx) => {
      await ctx.db.patch("tenants", fixture.tenants.nf, {
        status: "suspended",
      });
    });
    const viewer = await fixture
      .as("owner")
      .query(api.tenancy.viewer.get, { slug: nf });
    expect([...viewer.can].sort()).toEqual(["audit.view", "tenant.view"]);
  });

  it("denies another tenant's Owner, an account without a Person, and a suspended Person", async () => {
    const fixture = await createTenancyFixture();
    for (const account of ["otherOwner", "stranger", "suspended"] as const) {
      await expect(
        fixture.as(account).query(api.tenancy.viewer.get, { slug: nf })
      ).rejects.toMatchObject(notMember);
    }
  });

  it("answers an unknown tenant exactly like a foreign one", async () => {
    const fixture = await createTenancyFixture();
    await expect(
      fixture
        .as("owner")
        .query(api.tenancy.viewer.get, { slug: slugOf("missing") })
    ).rejects.toMatchObject(notMember);
  });

  it("refuses an operator Person without an audited grant", async () => {
    const fixture = await createTenancyFixture();
    await expect(
      fixture.as("visitor").query(api.tenancy.viewer.get, { slug: nf })
    ).rejects.toMatchObject({
      data: {
        _tag: "AccessDenied",
        action: "tenant.view",
        code: "ACCESS_DENIED",
        reason: "role",
      },
    });
  });

  it("requires a session", async () => {
    const fixture = await createTenancyFixture();
    await expect(
      fixture.t.query(api.tenancy.viewer.get, { slug: nf })
    ).rejects.toMatchObject({
      data: { _tag: "SessionRequired", code: "UNAUTHENTICATED" },
    });
  });
});
