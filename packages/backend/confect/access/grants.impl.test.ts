import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createTenancyFixture,
  slugOf,
  type TenancyFixture,
} from "@repo/backend/test/tenancy";

const nf = slugOf("nf");
const denied = (reason: "resource" | "role" | "condition") => ({
  data: { _tag: "AccessDenied", code: "ACCESS_DENIED", reason },
});
const notMember = { data: { _tag: "NotMember", code: "NOT_MEMBER" } };
const rejected = (code: string) => ({ data: { _tag: "GrantRejected", code } });

const entries = (fixture: TenancyFixture) =>
  fixture.t.run((ctx) => ctx.db.query("journalEntries").collect());
const grantOf = (
  fixture: TenancyFixture,
  id: TenancyFixture["people"]["owner"]["grantId"]
) => fixture.t.run((ctx) => ctx.db.get("tenantGrants", id));

describe("access/grants list", () => {
  it("shows a Person's grants to admins, unit admins of their unit, and themselves", async () => {
    const fixture = await createTenancyFixture();
    const teacher = { personId: fixture.people.teacher.personId, slug: nf };
    const expected = [
      {
        id: fixture.people.teacher.grantId,
        role: { key: "teacher", kind: "builtin" },
        scope: { kind: "unit", unitId: fixture.units.smp },
        term: { kind: "standing" },
      },
    ];
    for (const account of ["admin", "unitAdmin", "teacher"] as const) {
      await expect(
        fixture.as(account).query(api.access.grants.list, teacher)
      ).resolves.toEqual(expected);
    }
  });

  it("refuses roles that do not cover the Person", async () => {
    const fixture = await createTenancyFixture();
    await expect(
      fixture.as("unitAdmin").query(api.access.grants.list, {
        personId: fixture.people.principal.personId,
        slug: nf,
      })
    ).rejects.toMatchObject(denied("role"));
    await expect(
      fixture.as("teacher").query(api.access.grants.list, {
        personId: fixture.people.student.personId,
        slug: nf,
      })
    ).rejects.toMatchObject(denied("role"));
  });

  it("denies another tenant by slug and by Person ID", async () => {
    const fixture = await createTenancyFixture();
    await expect(
      fixture.as("otherOwner").query(api.access.grants.list, {
        personId: fixture.people.teacher.personId,
        slug: nf,
      })
    ).rejects.toMatchObject(notMember);
    await expect(
      fixture.as("admin").query(api.access.grants.list, {
        personId: fixture.people.otherOwner.personId,
        slug: nf,
      })
    ).rejects.toMatchObject(denied("resource"));
  });
});

describe("access/grants assign", () => {
  it("gives a role once, returns the same grant on retry, and records it under the Person", async () => {
    const fixture = await createTenancyFixture();
    const request = {
      personId: fixture.people.student.personId,
      role: "proctor",
      scope: { kind: "unit", unitId: fixture.units.smp },
      slug: nf,
    } as const;
    const owner = fixture.as("owner");
    const grantId = await owner.mutation(api.access.grants.assign, request);
    await expect(
      owner.mutation(api.access.grants.assign, request)
    ).resolves.toBe(grantId);
    expect(await entries(fixture)).toMatchObject([
      {
        actor: { id: fixture.people.owner.personId, kind: "person" },
        change: {
          grant: grantId,
          role: { key: "proctor", kind: "builtin" },
          scope: request.scope,
          term: { kind: "standing" },
          type: "grant.created",
        },
        owner: { kind: "tenant", tenantId: fixture.tenants.nf },
        subject: { id: fixture.people.student.personId, kind: "person" },
      },
    ]);
  });

  it("lets a unit admin manage roles in their own unit only", async () => {
    const fixture = await createTenancyFixture();
    const unitAdmin = fixture.as("unitAdmin");
    const assign = (unitId: typeof fixture.units.smp) =>
      unitAdmin.mutation(api.access.grants.assign, {
        personId: fixture.people.student.personId,
        role: "counselor",
        scope: { kind: "unit", unitId },
        slug: nf,
      });
    await expect(assign(fixture.units.smp)).resolves.toBeTypeOf("string");
    await expect(assign(fixture.units.sma)).rejects.toMatchObject(
      denied("role")
    );
    await expect(
      unitAdmin.mutation(api.access.grants.assign, {
        personId: fixture.people.student.personId,
        role: "counselor",
        scope: { kind: "tenant" },
        slug: nf,
      })
    ).rejects.toMatchObject(denied("role"));
  });

  it("keeps Owner and Admin roles with Owners", async () => {
    const fixture = await createTenancyFixture();
    await expect(
      fixture.as("admin").mutation(api.access.grants.assign, {
        personId: fixture.people.teacher.personId,
        role: "admin",
        scope: { kind: "tenant" },
        slug: nf,
      })
    ).rejects.toMatchObject(denied("role"));
    await expect(
      fixture.as("owner").mutation(api.access.grants.assign, {
        personId: fixture.people.teacher.personId,
        role: "admin",
        scope: { kind: "tenant" },
        slug: nf,
      })
    ).resolves.toBeTypeOf("string");
  });

  it("refuses an archived unit and a suspended tenant", async () => {
    const fixture = await createTenancyFixture();
    const assign = (unitId: typeof fixture.units.smp) =>
      fixture.as("owner").mutation(api.access.grants.assign, {
        personId: fixture.people.student.personId,
        role: "staff",
        scope: { kind: "unit", unitId },
        slug: nf,
      });
    await expect(assign(fixture.units.smk)).rejects.toMatchObject(
      denied("condition")
    );
    await fixture.t.run((ctx) =>
      ctx.db.patch("tenants", fixture.tenants.nf, { status: "suspended" })
    );
    await expect(assign(fixture.units.smp)).rejects.toMatchObject(
      denied("condition")
    );
  });

  it("denies another tenant by slug, by Person ID, and by unit ID", async () => {
    const fixture = await createTenancyFixture();
    const request = {
      personId: fixture.people.student.personId,
      role: "teacher",
      scope: { kind: "tenant" },
      slug: nf,
    } as const;
    await expect(
      fixture.as("otherOwner").mutation(api.access.grants.assign, request)
    ).rejects.toMatchObject(notMember);
    await expect(
      fixture.as("owner").mutation(api.access.grants.assign, {
        ...request,
        personId: fixture.people.otherOwner.personId,
      })
    ).rejects.toMatchObject(denied("resource"));
    await expect(
      fixture.as("owner").mutation(api.access.grants.assign, {
        ...request,
        scope: { kind: "unit", unitId: fixture.units.sd },
      })
    ).rejects.toMatchObject(denied("resource"));
  });

  it("refuses roles the tenant's invariants forbid", async () => {
    const fixture = await createTenancyFixture();
    const owner = fixture.as("owner");
    const assign = (
      personId: typeof fixture.invited,
      role: "integration" | "owner" | "teacher",
      scope:
        | { kind: "tenant" }
        | { kind: "unit"; unitId: typeof fixture.units.smp }
    ) =>
      owner.mutation(api.access.grants.assign, {
        personId,
        role,
        scope,
        slug: nf,
      });
    const tenantWide = { kind: "tenant" } as const;
    await expect(
      assign(fixture.visitor, "teacher", tenantWide)
    ).rejects.toMatchObject(rejected("PERSON_KIND"));
    await expect(
      assign(fixture.people.suspended.personId, "teacher", tenantWide)
    ).rejects.toMatchObject(rejected("PERSON_INACTIVE"));
    await expect(
      assign(fixture.people.student.personId, "integration", tenantWide)
    ).rejects.toMatchObject(rejected("GRANT_ROLE"));
    await expect(
      assign(fixture.people.student.personId, "owner", {
        kind: "unit",
        unitId: fixture.units.smp,
      })
    ).rejects.toMatchObject(rejected("GRANT_SCOPE"));
  });
});

describe("access/grants revoke", () => {
  it("ends a grant once, records it, and treats a repeat as done", async () => {
    const fixture = await createTenancyFixture();
    const request = { grantId: fixture.people.teacher.grantId, slug: nf };
    const owner = fixture.as("owner");
    await expect(
      owner.mutation(api.access.grants.revoke, request)
    ).resolves.toBeNull();
    await expect(
      owner.mutation(api.access.grants.revoke, request)
    ).resolves.toBeNull();
    expect(
      (await grantOf(fixture, fixture.people.teacher.grantId))?.status
    ).toBe("revoked");
    expect(await entries(fixture)).toMatchObject([
      {
        change: {
          grant: fixture.people.teacher.grantId,
          reason: "revoked",
          type: "grant.ended",
        },
        subject: { id: fixture.people.teacher.personId, kind: "person" },
      },
    ]);
  });

  it("keeps the last signed-in Owner and the Owner role with Owners", async () => {
    const fixture = await createTenancyFixture();
    const ownerGrant = { grantId: fixture.people.owner.grantId, slug: nf };
    await expect(
      fixture.as("admin").mutation(api.access.grants.revoke, ownerGrant)
    ).rejects.toMatchObject(denied("role"));
    await expect(
      fixture.as("owner").mutation(api.access.grants.revoke, ownerGrant)
    ).rejects.toMatchObject(rejected("LAST_OWNER"));
  });

  it("lets a holder see their grant but not end it", async () => {
    const fixture = await createTenancyFixture();
    await expect(
      fixture.as("student").mutation(api.access.grants.revoke, {
        grantId: fixture.people.student.grantId,
        slug: nf,
      })
    ).rejects.toMatchObject(denied("role"));
  });

  it("denies another tenant by slug and by grant ID", async () => {
    const fixture = await createTenancyFixture();
    await expect(
      fixture.as("otherOwner").mutation(api.access.grants.revoke, {
        grantId: fixture.people.teacher.grantId,
        slug: nf,
      })
    ).rejects.toMatchObject(notMember);
    await expect(
      fixture.as("owner").mutation(api.access.grants.revoke, {
        grantId: fixture.people.otherOwner.grantId,
        slug: nf,
      })
    ).rejects.toMatchObject(denied("resource"));
  });
});
