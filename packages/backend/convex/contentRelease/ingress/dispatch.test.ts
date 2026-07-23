// @vitest-environment node

import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { dispatchHandler } from "@repo/backend/convex/contentRelease/ingress/dispatch";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  publishIngressCandidate,
  publishIngressRecovery,
  sendPublication,
} from "@repo/backend/test/content-dispatch";
import {
  ingressItem,
  ingressRelease,
  ingressReleaseId,
  insertAbortedRelease,
  insertActiveRelease,
} from "@repo/backend/test/content-ingress";
import {
  TEST_PROOF_RENDERER,
  testProofRenderer,
} from "@repo/backend/test/content-proof";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("content publication Node dispatch", () => {
  it("publishes one authenticated release through every lifecycle boundary", async () => {
    const t = convexTest(schema, convexModules);

    const candidateResponses = await publishIngressCandidate(t);
    expect(
      candidateResponses.every(({ ok }) => ok),
      JSON.stringify(candidateResponses)
    ).toBe(true);
    expect(
      candidateResponses.map((response) => response.ok && response.operation)
    ).toEqual([
      "stageRelease",
      "current",
      "stageItemBatch",
      "stageRouteBatch",
      "stageProjectionBatch",
      "stageArtifactBatch",
      "status",
      "verify",
      "rollbackPage",
      "routePage",
    ]);

    const recoveryResponses = await publishIngressRecovery(t);
    expect(
      recoveryResponses.every(({ ok }) => ok),
      JSON.stringify(recoveryResponses)
    ).toBe(true);
    expect(recoveryResponses[4]).toMatchObject({
      ok: true,
      value: { kind: "missing" },
    });
    expect(recoveryResponses[9]).toMatchObject({
      ok: true,
      value: { kind: "completed" },
    });
    expect(recoveryResponses[11]).toMatchObject({
      ok: true,
      value: { heads: [] },
    });
    await expect(
      sendPublication(t, {
        activeManifestHash: ingressRelease.manifestHash,
        activeReleaseId: ingressReleaseId,
        cursor: "invalid-cursor",
        family: "material",
        limit: 10,
        operation: "headPage",
      })
    ).resolves.toMatchObject({
      failure: {
        code: "CONTENT_RELEASE_STATE",
        kind: "rejected",
        operation: "headPage",
      },
      ok: false,
    });
  });

  it("dispatches cleanup without accepting a caller-owned cursor", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertAbortedRelease);

    const first = await sendPublication(t, {
      operation: "cleanup",
      releaseId: "release-cleanup-dispatch",
    });
    const repeated = await sendPublication(t, {
      operation: "cleanup",
      releaseId: "release-cleanup-dispatch",
    });

    expect(first).toMatchObject({ ok: true, value: { complete: true } });
    expect(repeated).toEqual(first);
  });

  it("dispatches operator acceptance for one exact retained inverse", async () => {
    const t = convexTest(schema, convexModules);
    const active = {
      manifestHash: `sha256:${"8".repeat(64)}`,
      releaseId: "release-dispatch-active",
      sequence: 1,
    } satisfies TestIdentity;
    const recovery = {
      manifestHash: `sha256:${"9".repeat(64)}`,
      releaseId: "release-dispatch-recovery",
      sequence: 2,
    } satisfies TestIdentity;
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...active,
        role: "candidate",
        status: "completed",
      });
      await insertZeroRelease(ctx, {
        ...recovery,
        base: active,
        originReleaseId: active.releaseId,
        role: "recovery",
        status: "verified",
      });
      await insertTestState(ctx, { active, nextSequence: 3, recovery });
    });

    await expect(
      sendPublication(t, {
        operation: "accept",
        recoveryId: recovery.releaseId,
        releaseId: active.releaseId,
      })
    ).resolves.toMatchObject({
      ok: true,
      operation: "accept",
      value: { complete: true, releaseId: recovery.releaseId },
    });
  });

  it("returns the authoritative active release for a stale base", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertActiveRelease(ctx, "release-active"));

    const response = await sendPublication(t, {
      operation: "stageRelease",
      release: ingressRelease,
      rendererManifest: TEST_PROOF_RENDERER,
    });

    expect(response).toMatchObject({
      failure: {
        activeReleaseId: "release-active",
        code: "CONTENT_RELEASE_STALE_BASE",
        kind: "stale-base",
      },
      ok: false,
    });
  });

  it("fails closed when durable current state violates the contract", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      ctx.db.insert("contentState", {
        activeReleaseId: "",
        key: "primary",
        nextSequence: 1,
        updatedAt: 1,
      })
    );

    const response = await sendPublication(t, {
      operation: "stageRelease",
      release: ingressRelease,
      rendererManifest: TEST_PROOF_RENDERER,
    });

    expect(response).toMatchObject({
      failure: { code: "CONTENT_RELEASE_INTEGRITY", kind: "rejected" },
      ok: false,
    });
  });

  it("rejects tampered active release and renderer recovery bytes", async () => {
    for (const corruption of ["release", "renderer"] as const) {
      const t = convexTest(schema, convexModules);
      const manifestHash = await t.mutation(async (ctx) => {
        const activeHash = await insertActiveRelease(ctx, "release-active");
        const active = await ctx.db.query("contentReleases").unique();
        if (!active) {
          throw new Error("Expected completed active release.");
        }
        if (corruption === "renderer") {
          await ctx.db.patch("contentReleases", active._id, {
            rendererJson: JSON.stringify(testProofRenderer("h1")),
          });
          return activeHash;
        }
        const parsed = Schema.decodeUnknownSync(SignedContentReleaseSchema)(
          JSON.parse(active.releaseJson)
        );
        const signature = `${parsed.signature.startsWith("A") ? "B" : "A"}${parsed.signature.slice(1)}`;
        await ctx.db.patch("contentReleases", active._id, {
          releaseJson: JSON.stringify({ ...parsed, signature }),
        });
        return activeHash;
      });

      const response = await sendPublication(t, { operation: "current" });
      const status = await sendPublication(t, {
        manifestHash,
        operation: "status",
        releaseId: "release-active",
      });

      for (const result of [response, status]) {
        expect(result).toMatchObject({
          failure: { code: "CONTENT_RELEASE_INTEGRITY", kind: "rejected" },
          ok: false,
        });
      }
    }
  });

  it("rejects a stored row with a different signed release identity", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertActiveRelease(ctx, "release-active", "release-signed")
    );

    const response = await sendPublication(t, {
      activeManifestHash: await t.run(async (ctx) => {
        const state = await ctx.db.query("contentState").unique();
        return state?.activeManifestHash ?? "";
      }),
      activeReleaseId: "release-active",
      cursor: null,
      family: "material",
      limit: 10,
      operation: "headPage",
    });

    expect(response).toMatchObject({
      failure: { code: "CONTENT_RELEASE_INTEGRITY", kind: "rejected" },
      ok: false,
    });
  });

  it("runs the internal action boundary through the trusted registry", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.action((ctx) =>
      dispatchHandler(ctx, {
        byteLength: 2,
        source: "{}",
      })
    );

    expect(result.status).toBe(400);
  });

  it("sanitizes a non-stale domain rejection", async () => {
    const t = convexTest(schema, convexModules);

    const response = await sendPublication(t, {
      batchIndex: 0,
      items: [ingressItem],
      operation: "stageItemBatch",
      releaseId: ingressReleaseId,
    });

    expect(response).toMatchObject({
      failure: { code: "CONTENT_RELEASE_MISSING", kind: "rejected" },
      ok: false,
    });

    const missing = await sendPublication(t, {
      manifestHash: ingressRelease.manifestHash,
      operation: "status",
      releaseId: "release-missing",
    });
    expect(missing).toMatchObject({
      ok: true,
      value: { phase: "missing", releaseId: "release-missing" },
    });
  });
});
