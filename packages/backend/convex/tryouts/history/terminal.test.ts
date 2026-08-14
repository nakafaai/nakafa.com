import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { finalizeRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/finalize";
import {
  historyRead,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { proveTerminalHistory } from "@repo/backend/convex/tryouts/history/terminal";
import { readHistoryPage } from "@repo/backend/convex/tryouts/history/terminalPage";
import {
  TerminalHistorySource,
  type TerminalHistorySourceService,
} from "@repo/backend/convex/tryouts/history/terminalSource";
import {
  readFrozenPage,
  readIdentities,
  readSignedState,
} from "@repo/backend/convex/tryouts/history/terminalState";
import {
  prepareRetainedTryoutHistory,
  provideHistoryTestTrust,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

type HistoryFixture = Awaited<ReturnType<typeof seedRetainedTryoutHistory>>;
type TestTarget = ReturnType<typeof makeTarget>;
type Tamper = (ctx: MutationCtx, fixture: HistoryFixture) => Promise<void>;
const HISTORY_ERROR_CODE = /^TRYOUT_HISTORY_/;

describe("tryouts/history/terminal", () => {
  it("retries the same full proof after mutable source deletion", async () => {
    const target = makeTarget();
    const fixture = await prepareTerminalTarget(target);
    const expected = {
      artifacts: 4,
      attempts: 2,
      bundles: 2,
      catalogRows: 2,
      frozenPlacements: 2,
      markers: 2,
      placementRows: 2,
      progressRows: 2,
      snapshotId: fixture.plan.snapshotId,
    };

    await expect(runTerminalProof(target, fixture.plan)).resolves.toEqual(
      expected
    );
    await expect(runTerminalProof(target, fixture.plan)).resolves.toEqual(
      expected
    );
  });

  it.each(terminalIntegrityCases)(
    "fails closed when $name",
    async ({ tamper }) => {
      const target = makeTarget();
      const fixture = await prepareTerminalTarget(target);
      await target.mutation((ctx) => tamper(ctx, fixture));

      await expect(
        runTerminalFailure(target, fixture.plan)
      ).resolves.toMatchObject({
        _tag: "TryoutHistoryError",
        code: expect.stringMatching(HISTORY_ERROR_CODE),
      });
    }
  );
});

const terminalIntegrityCases: readonly {
  readonly name: string;
  readonly tamper: Tamper;
}[] = [
  {
    name: "one catalog history row is deleted",
    tamper: async (ctx) => {
      const row = await ctx.db
        .query("tryoutHistoryRows")
        .filter((query) => query.eq(query.field("rowKind"), "catalog"))
        .first();
      if (!row) {
        throw new Error("Expected terminal catalog fixture.");
      }
      await ctx.db.delete(row._id);
    },
  },
  {
    name: "one catalog history envelope is tampered",
    tamper: async (ctx) => {
      const row = await ctx.db
        .query("tryoutHistoryRows")
        .filter((query) => query.eq(query.field("rowKind"), "catalog"))
        .first();
      if (!row) {
        throw new Error("Expected terminal catalog fixture.");
      }
      await ctx.db.patch(row._id, { rowJson: "{}" });
    },
  },
  {
    name: "one placement history row is deleted",
    tamper: async (ctx) => {
      const row = await ctx.db
        .query("tryoutHistoryRows")
        .filter((query) => query.eq(query.field("rowKind"), "placement"))
        .first();
      if (!row) {
        throw new Error("Expected terminal placement fixture.");
      }
      await ctx.db.delete(row._id);
    },
  },
  {
    name: "one placement history index is tampered",
    tamper: async (ctx) => {
      const row = await ctx.db
        .query("tryoutHistoryRows")
        .filter((query) => query.eq(query.field("rowKind"), "placement"))
        .first();
      if (!row) {
        throw new Error("Expected terminal placement fixture.");
      }
      await ctx.db.patch(row._id, { index: row.index + 1 });
    },
  },
  {
    name: "one frozen attempt placement is deleted",
    tamper: async (ctx) => {
      const row = await ctx.db.query("tryoutAttemptPlacements").first();
      if (!row) {
        throw new Error("Expected terminal frozen placement fixture.");
      }
      await ctx.db.delete(row._id);
    },
  },
  {
    name: "one frozen content hash is tampered",
    tamper: async (ctx) => {
      const row = await ctx.db.query("tryoutAttemptPlacements").first();
      if (!row) {
        throw new Error("Expected terminal frozen placement fixture.");
      }
      await ctx.db.patch(row._id, { contentHash: "changed" });
    },
  },
  {
    name: "one progress row is deleted",
    tamper: async (ctx) => {
      const row = await ctx.db.query("tryoutSetProgress").first();
      if (!row) {
        throw new Error("Expected terminal progress fixture.");
      }
      await ctx.db.delete(row._id);
    },
  },
  {
    name: "one progress locale is tampered",
    tamper: async (ctx) => {
      const row = await ctx.db.query("tryoutSetProgress").first();
      if (!row) {
        throw new Error("Expected terminal progress fixture.");
      }
      await ctx.db.patch(row._id, {
        appLocale: row.locale === "en" ? "id" : "en",
      });
    },
  },
  {
    name: "the retained snapshot bytes are tampered",
    tamper: async (ctx) => {
      const row = await ctx.db.query("contentSnapshots").first();
      if (!row) {
        throw new Error("Expected terminal snapshot fixture.");
      }
      await ctx.db.patch(row._id, { snapshotJson: "{}" });
    },
  },
  {
    name: "the second retained bundle bytes are tampered",
    tamper: async (ctx, fixture) => {
      const release = fixture.plan.releases[1];
      if (!release) {
        throw new Error("Expected second retained release fixture.");
      }
      const row = await ctx.db
        .query("tryoutBundles")
        .withIndex("by_releaseId", (query) =>
          query.eq("releaseId", release.releaseId)
        )
        .unique();
      if (!row) {
        throw new Error("Expected second retained bundle fixture.");
      }
      await ctx.db.patch(row._id, { releaseJson: "{}" });
    },
  },
  {
    name: "the second retained renderer bytes are tampered",
    tamper: async (ctx, fixture) => {
      const release = fixture.plan.releases[1];
      if (!release) {
        throw new Error("Expected second retained release fixture.");
      }
      const row = await ctx.db
        .query("tryoutBundles")
        .withIndex("by_releaseId", (query) =>
          query.eq("releaseId", release.releaseId)
        )
        .unique();
      if (!row) {
        throw new Error("Expected second retained bundle fixture.");
      }
      await ctx.db.patch(row._id, { rendererJson: "{}" });
    },
  },
  {
    name: "one retained artifact is tampered",
    tamper: async (ctx) => {
      const row = await ctx.db.query("contentArtifacts").first();
      if (!row) {
        throw new Error("Expected terminal artifact fixture.");
      }
      await ctx.db.patch(row._id, { artifactJson: "{}" });
    },
  },
  {
    name: "one history envelope is duplicated",
    tamper: async (ctx) => {
      const row = await ctx.db
        .query("tryoutHistoryRows")
        .filter((query) => query.eq(query.field("rowKind"), "catalog"))
        .first();
      if (row?.rowKind !== "catalog") {
        throw new Error("Expected terminal catalog fixture.");
      }
      await ctx.db.insert("tryoutHistoryRows", {
        index: row.index,
        rowHash: row.rowHash,
        rowJson: row.rowJson,
        rowKind: row.rowKind,
        snapshotId: row.snapshotId,
      });
    },
  },
  {
    name: "one history row crosses snapshots",
    tamper: async (ctx) => {
      const row = await ctx.db.query("tryoutHistoryRows").first();
      if (!row) {
        throw new Error("Expected terminal history fixture.");
      }
      await ctx.db.patch(row._id, { snapshotId: "sha256:changed" });
    },
  },
  {
    name: "one attempt crosses retained releases",
    tamper: async (ctx, fixture) => {
      const release = fixture.plan.releases[1];
      const attempt = await ctx.db.get("tryoutAttempts", fixture.attemptIds[0]);
      if (!(release && attempt)) {
        throw new Error("Expected terminal attempt fixture.");
      }
      await ctx.db.patch(attempt._id, { snapshotReleaseId: release.releaseId });
    },
  },
];

function makeTarget() {
  return convexTest(schema, convexModules);
}

function prepareTerminalTarget(target: TestTarget) {
  return target.mutation(async (ctx) => {
    const fixture = await seedRetainedTryoutHistory(ctx);
    await prepareRetainedTryoutHistory(ctx, fixture);
    await runConvexProgram(
      provideHistoryTestTrust(finalizeRetainedTryoutHistory(ctx, fixture.plan))
    );
    for (const row of await ctx.db.query("tryoutCatalog").collect()) {
      await ctx.db.delete(row._id);
    }
    for (const row of await ctx.db.query("tryoutPlacements").collect()) {
      await ctx.db.delete(row._id);
    }
    return fixture;
  });
}

function runTerminalProof(target: TestTarget, plan: RetainedTryoutHistoryPlan) {
  return Effect.runPromise(terminalProgram(target, plan));
}

function runTerminalFailure(
  target: TestTarget,
  plan: RetainedTryoutHistoryPlan
) {
  return Effect.runPromise(terminalProgram(target, plan).pipe(Effect.flip));
}

function terminalProgram(target: TestTarget, plan: RetainedTryoutHistoryPlan) {
  return provideHistoryTestTrust(
    proveTerminalHistory(plan).pipe(
      Effect.provideService(
        TerminalHistorySource,
        makeTestTerminalSource(target, plan)
      )
    )
  );
}

function makeTestTerminalSource(
  target: TestTarget,
  plan: RetainedTryoutHistoryPlan
): TerminalHistorySourceService {
  return {
    frozenPage: (cursor) =>
      historyRead("Unable to test terminal frozen page.", () =>
        target.query((ctx) => runConvexProgram(readFrozenPage(ctx, cursor)))
      ),
    historyPage: (cursor) =>
      historyRead("Unable to test terminal history page.", () =>
        target.query((ctx) => runConvexProgram(readHistoryPage(ctx, cursor)))
      ),
    identities: () =>
      historyRead("Unable to test terminal identities.", () =>
        target.query((ctx) => runConvexProgram(readIdentities(ctx, plan)))
      ),
    signedState: () =>
      historyRead("Unable to test terminal signed state.", () =>
        target.query((ctx) => runConvexProgram(readSignedState(ctx, plan)))
      ),
  };
}
