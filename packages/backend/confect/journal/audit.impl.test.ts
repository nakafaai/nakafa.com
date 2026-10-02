import { describe, expect, it } from "@effect/vitest";
import { ChangeView, SubjectView } from "@repo/backend/confect/journal/schema";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createTenancyFixture,
  slugOf,
  type TenancyFixture,
} from "@repo/backend/test/tenancy";
import { Schema } from "effect";

const nf = slugOf("nf");
const page = (numItems: number) => ({
  paginationOpts: { cursor: null, numItems },
  slug: nf,
});

/** Inserts tenant-owned entries the way `record` files them. */
const seedEntries = (
  fixture: TenancyFixture,
  tenant: "nf" | "other",
  count: number
) =>
  fixture.t.run(async (ctx) => {
    for (let index = 0; index < count; index += 1) {
      await ctx.db.insert("journalEntries", {
        actor: { kind: "system" },
        change: { type: "tenant.provisioned" },
        owner: { kind: "tenant", tenantId: fixture.tenants[tenant] },
        subject: { id: fixture.tenants[tenant], kind: "tenant" },
      });
    }
  });

describe("journal/audit list", () => {
  it("shows the member tenant's changes newest first with Person names", async () => {
    const fixture = await createTenancyFixture();
    await seedEntries(fixture, "other", 2);
    await seedEntries(fixture, "nf", 1);
    const owner = fixture.as("owner");
    const grantId = await owner.mutation(api.access.grants.assign, {
      personId: fixture.people.student.personId,
      role: "proctor",
      scope: { kind: "tenant" },
      slug: nf,
    });
    await owner.mutation(api.access.grants.revoke, { grantId, slug: nf });
    const result = await owner.query(api.journal.audit.list, page(10));
    const actor = {
      id: fixture.people.owner.personId,
      kind: "person",
      name: "Owner",
    };
    const subject = { id: fixture.people.student.personId, kind: "person" };
    expect(result.page).toMatchObject([
      {
        actor,
        change: { grant: grantId, reason: "revoked", type: "grant.ended" },
        subject,
        subjectName: "Student",
      },
      {
        actor,
        change: { grant: grantId, type: "grant.created" },
        subject,
        subjectName: "Student",
      },
      {
        actor: { kind: "system" },
        change: { type: "tenant.provisioned" },
        subject: { id: fixture.tenants.nf, kind: "tenant" },
        subjectName: null,
      },
    ]);
    expect(result.isDone).toBe(true);
  });

  it("reads at most 100 entries per page", async () => {
    const fixture = await createTenancyFixture();
    await seedEntries(fixture, "nf", 101);
    const result = await fixture
      .as("auditor")
      .query(api.journal.audit.list, page(500));
    expect(result.page).toHaveLength(100);
    expect(result.isDone).toBe(false);
  });

  it("keeps the log from teachers, unit-scoped principals, and other tenants", async () => {
    const fixture = await createTenancyFixture();
    for (const account of ["teacher", "principal"] as const) {
      await expect(
        fixture.as(account).query(api.journal.audit.list, page(10))
      ).rejects.toMatchObject({
        data: { _tag: "AccessDenied", action: "audit.view", reason: "role" },
      });
    }
    await expect(
      fixture.as("otherOwner").query(api.journal.audit.list, page(10))
    ).rejects.toMatchObject({ data: { _tag: "NotMember" } });
  });

  it("lets an older client read change types and kinds added after it was built", () => {
    expect(
      Schema.decodeUnknownSync(ChangeView)({ seat: 3, type: "seat.added" })
    ).toEqual({ type: "unknown" });
    expect(
      Schema.decodeUnknownSync(SubjectView)({ id: "id", kind: "cohort" })
    ).toEqual({ kind: "unknown" });
  });
});
