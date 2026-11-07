import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  countAccounts,
  ensureAccountSeat,
} from "@repo/backend/confect/billing/seats";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  exitInMutation,
  insertSchool,
  runInMutation,
} from "@repo/backend/test/billing";
import { Array as Arr, Cause, Exit } from "effect";

const NOW = Date.UTC(2026, 10, 7);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Gives one Person a grant of `role` in one unit, active or ended. */
function insertRoleGrant(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  personId: Id<"tenantPeople">,
  unitId: Id<"tenantUnits">,
  role: "guardian" | "integration" | "student" | "teacher",
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

/** One unit of a school. */
function insertUnit(ctx: MutationCtx, tenantId: Id<"tenants">) {
  return ctx.db.insert("tenantUnits", {
    contentLanguage: "id",
    level: "smp",
    name: "SMP",
    status: "active",
    tenantId,
    timeZone: "Asia/Jakarta",
  });
}

/** One member Person of a school. */
function insertPerson(ctx: MutationCtx, tenantId: Id<"tenants">) {
  return ctx.db.insert("tenantPeople", {
    account: { state: "unclaimed" },
    kind: "member",
    name: "Orang",
    status: "active",
    tenantId,
  });
}

describe("billing/seats", () => {
  it("counts each person once across every role and unit, and no integration or ended grant", async () => {
    const t = createBillingTestConvex();
    const count = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const [first, second] = [
        await insertUnit(ctx, tenantId),
        await insertUnit(ctx, tenantId),
      ];
      const [ani, guru, wali, gone, api] = [
        await insertPerson(ctx, tenantId),
        await insertPerson(ctx, tenantId),
        await insertPerson(ctx, tenantId),
        await insertPerson(ctx, tenantId),
        await insertPerson(ctx, tenantId),
      ];
      await insertRoleGrant(ctx, tenantId, ani, first, "student");
      await insertRoleGrant(ctx, tenantId, ani, second, "student");
      await insertRoleGrant(ctx, tenantId, guru, first, "teacher");
      await insertRoleGrant(ctx, tenantId, guru, first, "guardian");
      await insertRoleGrant(ctx, tenantId, wali, first, "guardian");
      await insertRoleGrant(ctx, tenantId, gone, first, "student", "revoked");
      await insertRoleGrant(ctx, tenantId, api, first, "integration");
      return await runInMutation(ctx, countAccounts(tenantId));
    });
    expect(count).toBe(3);
  });

  it("holds a trial school to its 20 accounts and a paid school to the accounts its grants pay for", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const unit = await insertUnit(ctx, tenantId);
      for (const _ of Arr.range(1, 20)) {
        await insertRoleGrant(
          ctx,
          tenantId,
          await insertPerson(ctx, tenantId),
          unit,
          "student"
        );
      }
      const outcome = async () =>
        Exit.match(await exitInMutation(ctx, ensureAccountSeat(tenantId)), {
          onFailure: (cause) => String(Cause.squash(cause)),
          onSuccess: () => "seat",
        });
      const trial = await outcome();
      await ctx.db.insert("billingGrants", {
        product: "school",
        tenantId,
        scope: { kind: "tenant" },
        seats: 21,
        ninaSeats: 21,
        source: { kind: "contract", contractId: "contract-seats" },
        validFrom: 0,
        validTo: NOW + 1000,
      });
      const paid = await outcome();
      return { paid, trial };
    });
    expect(result.trial).toContain("GrantRejected");
    expect(result.paid).toBe("seat");
  });
});
