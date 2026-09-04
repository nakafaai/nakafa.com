import { describe, expect, it } from "@effect/vitest";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  type OnboardingLifecycleCounts,
  onboardingLifecyclePageBytes,
  readLifecyclePage,
} from "@repo/backend/convex/onboarding/lifecycle";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import type { PaginationOptions, PaginationResult } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";

const NOW = Date.UTC(2026, 8, 4, 8, 0, 0);
const lifecyclePage = makeFunctionReference<
  "query",
  { paginationOpts: PaginationOptions },
  PaginationResult<OnboardingLifecycleCounts>
>("onboarding/lifecycle:readLifecyclePage");

type UserSeed = Pick<Doc<"users">, "deletedAt" | "role">;
type ProfileSeed = Pick<
  Doc<"onboardingProfiles">,
  "admittedAt" | "completedAt" | "startedAt"
>;

/** Inserts one content-free fixture user and optional lifecycle milestones. */
async function insertLifecycleFixture(
  ctx: MutationCtx,
  suffix: string,
  user: UserSeed,
  profile?: ProfileSeed
) {
  const userId = await ctx.db.insert("users", {
    authId: `auth-${suffix}`,
    credits: 10,
    creditsResetAt: NOW,
    email: `${suffix}@example.com`,
    name: `Synthetic ${suffix}`,
    plan: "free",
    ...user,
  });

  if (profile) {
    await ctx.db.insert("onboardingProfiles", {
      ...profile,
      updatedAt: NOW,
      userId,
    });
  }
}

describe("onboarding/lifecycle", () => {
  it("returns only aggregate evidence for every factual lifecycle state", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertLifecycleFixture(ctx, "not-admitted", {});
      await insertLifecycleFixture(ctx, "admitted", {}, { admittedAt: NOW });
      await insertLifecycleFixture(
        ctx,
        "started",
        {},
        { admittedAt: NOW, startedAt: NOW + 1 }
      );
      await insertLifecycleFixture(
        ctx,
        "started-without-admission",
        {},
        { startedAt: NOW + 1 }
      );
      await insertLifecycleFixture(
        ctx,
        "complete",
        { role: "student" },
        { admittedAt: NOW, completedAt: NOW + 2, startedAt: NOW + 1 }
      );
      await insertLifecycleFixture(
        ctx,
        "complete-without-role",
        {},
        { admittedAt: NOW, completedAt: NOW + 2, startedAt: NOW + 1 }
      );
      await insertLifecycleFixture(
        ctx,
        "historical-complete",
        { role: "administrator" },
        { completedAt: NOW }
      );
      await insertLifecycleFixture(ctx, "privileged", {
        role: "administrator",
      });
      await insertLifecycleFixture(ctx, "deleted", { deletedAt: NOW });
    });

    const result = await target.query(lifecyclePage, {
      paginationOpts: {
        cursor: null,
        maximumBytesRead: onboardingLifecyclePageBytes,
        maximumRowsRead: 64,
        numItems: 64,
      },
    });

    expect(result.page).toEqual([
      {
        dataQuality: {
          completedWithoutAdmission: 1,
          completedWithoutRole: 1,
          completedWithoutStart: 1,
          startedWithoutAdmission: 1,
        },
        incomplete: {
          admittedNotStarted: 1,
          noRecordedAdmission: 1,
          startedNotCompleted: 2,
        },
        milestones: {
          admitted: 4,
          completed: 3,
          started: 4,
        },
        population: {
          eligible: 7,
          excluded: 2,
          scanned: 9,
        },
      },
    ]);
    expect(result.isDone).toBe(true);
    expect(JSON.stringify(result)).not.toContain("@example.com");
    expect(JSON.stringify(result)).not.toContain("Synthetic");
    expect(JSON.stringify(result)).not.toContain(String(NOW));
  });

  it("preserves native cursors while bounding each fan-out page", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertLifecycleFixture(ctx, "page-1", {});
      await insertLifecycleFixture(ctx, "page-2", {});
      await insertLifecycleFixture(ctx, "page-3", {});
    });

    const first = await target.query(lifecyclePage, {
      paginationOpts: {
        cursor: null,
        maximumBytesRead: onboardingLifecyclePageBytes,
        maximumRowsRead: 2,
        numItems: 2,
      },
    });
    const second = await target.query(lifecyclePage, {
      paginationOpts: {
        cursor: first.continueCursor,
        maximumBytesRead: onboardingLifecyclePageBytes,
        maximumRowsRead: 2,
        numItems: 2,
      },
    });

    expect(first.isDone).toBe(false);
    expect(first.page[0]?.population.scanned).toBe(2);
    expect(second.isDone).toBe(true);
    expect(second.page[0]?.population.scanned).toBe(1);
    expect(
      (first.page[0]?.incomplete.noRecordedAdmission ?? 0) +
        (second.page[0]?.incomplete.noRecordedAdmission ?? 0)
    ).toBe(3);
  });

  it.each([
    { cursor: null, numItems: 1 },
    {
      cursor: null,
      maximumRowsRead: 1,
      numItems: 1,
    },
    {
      cursor: null,
      maximumBytesRead: onboardingLifecyclePageBytes,
      maximumRowsRead: 1,
      numItems: 1.5,
    },
    {
      cursor: null,
      maximumBytesRead: onboardingLifecyclePageBytes,
      maximumRowsRead: 1.5,
      numItems: 1,
    },
    {
      cursor: null,
      maximumBytesRead: 1.5,
      maximumRowsRead: 1,
      numItems: 1,
    },
    {
      cursor: null,
      maximumBytesRead: onboardingLifecyclePageBytes,
      maximumRowsRead: 64,
      numItems: 65,
    },
    {
      cursor: null,
      maximumBytesRead: onboardingLifecyclePageBytes,
      maximumRowsRead: 65,
      numItems: 64,
    },
    {
      cursor: null,
      maximumBytesRead: onboardingLifecyclePageBytes,
      maximumRowsRead: 1,
      numItems: 2,
    },
    {
      cursor: null,
      maximumBytesRead: onboardingLifecyclePageBytes + 1,
      maximumRowsRead: 1,
      numItems: 1,
    },
    {
      cursor: null,
      maximumBytesRead: 0,
      maximumRowsRead: 1,
      numItems: 1,
    },
    {
      cursor: null,
      maximumBytesRead: onboardingLifecyclePageBytes,
      maximumRowsRead: 1,
      numItems: 0,
    },
  ] satisfies PaginationOptions[])(
    "rejects unsafe page budget %#",
    async (paginationOpts) => {
      const target = convexTest(schema, convexModules);

      await expect(
        target.query(lifecyclePage, { paginationOpts })
      ).rejects.toMatchObject({
        data: { code: "ONBOARDING_LIFECYCLE_INVALID_PAGE" },
      });
    }
  );

  it("reports duplicate profiles through the typed read failure", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-duplicate",
        credits: 10,
        creditsResetAt: NOW,
        email: "duplicate@example.com",
        name: "Synthetic duplicate",
        plan: "free",
      });
      await ctx.db.insert("onboardingProfiles", {
        admittedAt: NOW,
        updatedAt: NOW,
        userId,
      });
      await ctx.db.insert("onboardingProfiles", {
        admittedAt: NOW + 1,
        updatedAt: NOW + 1,
        userId,
      });
    });

    await expect(
      target.query(lifecyclePage, {
        paginationOpts: {
          cursor: null,
          maximumBytesRead: onboardingLifecyclePageBytes,
          maximumRowsRead: 1,
          numItems: 1,
        },
      })
    ).rejects.toMatchObject({
      data: { code: "ONBOARDING_LIFECYCLE_READ_FAILED" },
    });
  });

  it("registers the private reader instead of a public API", () => {
    expect(readLifecyclePage.isInternal).toBe(true);
  });
});
