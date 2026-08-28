import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import {
  abandonPredecessorObservation,
  readPredecessorObservation,
  sealPredecessorObservation,
} from "@repo/backend/convex/contentRelease/predecessor/control";
import { recordPredecessorRead } from "@repo/backend/convex/contentRelease/predecessor/record";
import {
  PREDECESSOR_QUIET_WINDOW_MS,
  PREDECESSOR_ROUTES,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  PREDECESSOR_OBSERVATION_ID,
  seedPredecessorObservation,
} from "@repo/backend/test/predecessor";
import { convexTest } from "convex-test";

describe("contentRelease/predecessor/record", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is inactive before observation is armed", async () => {
    const target = convexTest(schema, convexModules);
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "singular"))
      )
    ).resolves.toEqual({ kind: "inactive" });
  });

  it("counts concurrent route reads exactly and resets each quiet clock", async () => {
    const target = convexTest(schema, convexModules);
    await seedPredecessorObservation(target);
    const routes = Array.from({ length: 32 }, (_, index) =>
      index % 2 === 0 ? ("singular" as const) : ("batch" as const)
    );

    const results = await Promise.all(
      routes.map((route) =>
        target.mutation((ctx) =>
          runConvexProgram(recordPredecessorRead(ctx, route))
        )
      )
    );
    expect(results).toEqual(
      Array.from({ length: routes.length }, () => ({ kind: "recorded" }))
    );

    const status = await target.query((ctx) =>
      runConvexProgram(
        readPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
      )
    );
    expect(status.routes.singular.invocationCount).toBe(16);
    expect(status.routes.batch.invocationCount).toBe(16);
    expect(status.routes.history.invocationCount).toBe(0);
    expect(status.routes.protected.invocationCount).toBe(0);
    expect(status.routes.singular.quietSince).toBe(
      status.routes.singular.lastInvokedAt
    );
    expect(status.routes.batch.quietSince).toBe(
      status.routes.batch.lastInvokedAt
    );
    expect(status).not.toHaveProperty("readyToSeal");
    expect(status.routes.singular).not.toHaveProperty("quietForMs");
  });

  it("rejects a saturated invocation counter", async () => {
    const target = convexTest(schema, convexModules);
    await seedPredecessorObservation(target);
    await target.mutation(async (ctx) => {
      const singular = await ctx.db
        .query("contentPredecessorReads")
        .withIndex("by_route", (query) => query.eq("route", "singular"))
        .unique();
      if (!singular) {
        throw new Error("Expected the singular observation row.");
      }
      await ctx.db.patch("contentPredecessorReads", singular._id, {
        invocationCount: Number.MAX_SAFE_INTEGER,
      });
    });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "singular"))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("reopens and expands a deployed sealed pair before recording", async () => {
    const target = convexTest(schema, convexModules);
    const armedAt = Date.UTC(2026, 7, 26, 8);
    vi.setSystemTime(armedAt);
    await seedPredecessorObservation(target);
    vi.setSystemTime(armedAt + PREDECESSOR_QUIET_WINDOW_MS);
    await target.mutation((ctx) =>
      runConvexProgram(
        sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
      )
    );
    await target.mutation(async (ctx) => {
      const rows = await ctx.db.query("contentPredecessorReads").collect();
      for (const row of rows) {
        if (row.route === "protected" || row.route === "history") {
          await ctx.db.delete("contentPredecessorReads", row._id);
        }
      }
    });

    const recordedAt = armedAt + PREDECESSOR_QUIET_WINDOW_MS + 1;
    vi.setSystemTime(recordedAt);
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "protected"))
      )
    ).resolves.toEqual({ kind: "recorded" });

    const status = await target.query((ctx) =>
      runConvexProgram(
        readPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
      )
    );
    expect(status.routes).toMatchObject({
      batch: { phase: "armed", quietSince: recordedAt },
      history: { invocationCount: 0, phase: "armed", quietSince: recordedAt },
      protected: {
        invocationCount: 1,
        lastInvokedAt: recordedAt,
        phase: "armed",
        quietSince: recordedAt,
      },
      singular: { phase: "armed", quietSince: recordedAt },
    });
    for (const route of PREDECESSOR_ROUTES) {
      expect(status.routes[route]).not.toHaveProperty("sealedAt");
    }
  });

  it.each(PREDECESSOR_ROUTES)(
    "reopens a sealed observation for a late %s read",
    async (route) => {
      const target = convexTest(schema, convexModules);
      const armedAt = Date.UTC(2026, 7, 26, 8);
      vi.setSystemTime(armedAt);
      await seedPredecessorObservation(target);
      vi.setSystemTime(armedAt + PREDECESSOR_QUIET_WINDOW_MS);
      await target.mutation((ctx) =>
        runConvexProgram(
          sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      );

      const lateReadAt = armedAt + PREDECESSOR_QUIET_WINDOW_MS + 1;
      vi.setSystemTime(lateReadAt);
      await expect(
        target.mutation((ctx) =>
          runConvexProgram(recordPredecessorRead(ctx, route))
        )
      ).resolves.toEqual({ kind: "recorded" });

      const status = await target.query((ctx) =>
        runConvexProgram(
          readPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      );
      expect(status).toMatchObject({
        kind: "active",
        routes: {
          [route]: {
            invocationCount: 1,
            lastInvokedAt: lateReadAt,
            phase: "armed",
            quietSince: lateReadAt,
          },
        },
      });
      for (const candidate of PREDECESSOR_ROUTES) {
        expect(status.routes[candidate]).not.toHaveProperty("sealedAt");
      }
      await expect(
        target.mutation((ctx) =>
          runConvexProgram(
            abandonPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
          )
        )
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

      vi.setSystemTime(lateReadAt + PREDECESSOR_QUIET_WINDOW_MS - 1);
      await expect(
        target.mutation((ctx) =>
          runConvexProgram(
            sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
          )
        )
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
      vi.setSystemTime(lateReadAt + PREDECESSOR_QUIET_WINDOW_MS);
      await expect(
        target.mutation((ctx) =>
          runConvexProgram(
            sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
          )
        )
      ).resolves.toMatchObject({
        routes: {
          batch: { phase: "sealed" },
          history: { phase: "sealed" },
          protected: { phase: "sealed" },
          singular: { phase: "sealed" },
        },
      });
    }
  );
});
