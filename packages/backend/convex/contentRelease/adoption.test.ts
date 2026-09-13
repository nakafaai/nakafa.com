// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { adoptHistory } from "@repo/backend/convex/contentRelease/adoption";
import type { AdoptionRequest } from "@repo/backend/convex/contentRelease/adoption/spec";
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { insertAdoptionHistory } from "@repo/backend/test/content/adoption";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content/proof";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content/proof"
  );
  return { contentKeyResolver: TEST_KEY_RESOLVER };
});

describe("contentRelease/adoption", () => {
  it("reauthenticates source, bundle and unchanged signed bodies before atomic adoption", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) => insertAdoptionHistory(ctx, true));
    const result = await t.action((ctx) =>
      runConvexActionProgram(
        adoptHistory(ctx, {
          ...fixture.identity,
          expectedHistoryHash: fixture.state.historyHash,
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
        )
      )
    );
    expect(result).toEqual({
      attempts: 1,
      placements: 1,
      scores: 1,
      scales: 1,
      scaleItems: 1,
    });
    const attempt = await t.query((ctx) =>
      ctx.db.get("tryoutAttempts", fixture.seed.request.attemptId)
    );
    expect(attempt?.tryoutSnapshotId).toBe(fixture.state.newBundle.snapshotId);
  });

  it("rejects a different reviewed inventory before any body or pointer update", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) => insertAdoptionHistory(ctx, true));
    await expect(
      t.action((ctx) =>
        runConvexActionProgram(
          adoptHistory(ctx, {
            ...fixture.identity,
            expectedHistoryHash: "different",
          }).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
    const attempt = await t.query((ctx) =>
      ctx.db.get("tryoutAttempts", fixture.seed.request.attemptId)
    );
    expect(attempt?.tryoutSnapshotId).toBe(fixture.state.oldBundle.snapshotId);
  });

  it("never adopts freshly authored replacements for historical bodies", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) => insertAdoptionHistory(ctx));
    await expect(
      t.action((ctx) =>
        runConvexActionProgram(
          adoptHistory(ctx, {
            ...fixture.identity,
            expectedHistoryHash: fixture.state.historyHash,
          }).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    const attempt = await t.query((ctx) =>
      ctx.db.get("tryoutAttempts", fixture.seed.request.attemptId)
    );
    expect(attempt?.tryoutBundleHash).toBe(fixture.state.oldBundle.bundleHash);
  });
  it("uses the registered private action trust boundary and rejects missing signed bodies", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) => insertAdoptionHistory(ctx, true));
    const reference = makeFunctionReference<"action", AdoptionRequest>(
      "contentRelease/adoption:history"
    );
    expect(
      await t.action(reference, {
        ...fixture.identity,
        expectedHistoryHash: fixture.state.historyHash,
      })
    ).toEqual({
      attempts: 1,
      placements: 1,
      scores: 1,
      scales: 1,
      scaleItems: 1,
    });
    const artifacts = makeFunctionReference<
      "query",
      { priorHash: string; nextHash: string }
    >("contentRelease/adoption/internal:artifacts");
    await expect(
      t.query(artifacts, { priorHash: "missing", nextHash: "missing" })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });
});
