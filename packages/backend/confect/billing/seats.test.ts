import { describe, expect, it } from "@effect/vitest";
import { countStudents } from "@repo/backend/confect/billing/seats";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertSchool,
  runInMutation,
} from "@repo/backend/test/billing";

/** Gives one Person a grant of `role` in one unit, active or ended. */
function insertRoleGrant(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  personId: Id<"tenantPeople">,
  unitId: Id<"tenantUnits">,
  role: "student" | "teacher",
  status: "active" | "revoked" = "active"
) {
  return ctx.db.insert("tenantGrants", {
    grantedBy: { kind: "system" },
    personId,
    role: { key: role, kind: "builtin" },
    scope: { kind: "unit", unitId },
    status,
    tenantId,
    term: { kind: "standing" },
  });
}

describe("billing/seats", () => {
  it("counts each student once, however many units they study in, and no teacher or ended grant", async () => {
    const t = createBillingTestConvex();
    const count = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const unit = () =>
        ctx.db.insert("tenantUnits", {
          contentLanguage: "id",
          level: "smp",
          name: "SMP",
          status: "active",
          tenantId,
          timeZone: "Asia/Jakarta",
        });
      const person = () =>
        ctx.db.insert("tenantPeople", {
          account: { state: "unclaimed" },
          kind: "member",
          name: "Siswa",
          status: "active",
          tenantId,
        });
      const [first, second] = [await unit(), await unit()];
      const [ani, budi, cici, guru] = [
        await person(),
        await person(),
        await person(),
        await person(),
      ];
      await insertRoleGrant(ctx, tenantId, ani, first, "student");
      await insertRoleGrant(ctx, tenantId, ani, second, "student");
      await insertRoleGrant(ctx, tenantId, budi, first, "student");
      await insertRoleGrant(ctx, tenantId, cici, first, "student", "revoked");
      await insertRoleGrant(ctx, tenantId, guru, first, "teacher");
      return await runInMutation(ctx, countStudents(tenantId));
    });
    expect(count).toBe(2);
  });
});
