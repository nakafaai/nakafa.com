import { describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
  zeroReleaseJson,
} from "@repo/backend/test/content/state";
import { convexTest, type TestConvex } from "convex-test";

const currentRelease = internal.contentRelease.status.current;
const releaseStatus = internal.contentRelease.status.getStatus;
const ACTIVE = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "release-active",
  sequence: 1,
} satisfies TestIdentity;

/** Reads one release status through its exact signed identity. */
function getStatus(
  t: TestConvex<typeof schema>,
  manifestHash: string = TEST_MANIFEST_HASH,
  releaseId: string = TEST_RELEASE_ID
) {
  return t.query(releaseStatus, { manifestHash, releaseId });
}

/** Requires the singleton content release row used by a test fixture. */
async function requireRelease(ctx: MutationCtx) {
  const release = await ctx.db.query("contentReleases").unique();
  if (!release) {
    throw new Error("Expected release fixture.");
  }
  return release;
}

/** Requires the singleton publication state used by a test fixture. */
async function requireState(ctx: MutationCtx) {
  const state = await ctx.db.query("contentState").unique();
  if (!state) {
    throw new Error("Expected release state fixture.");
  }
  return state;
}

describe("contentRelease/status", () => {
  it("returns authoritative empty and staged publication state", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(empty.query(currentRelease, {})).resolves.toEqual({
      active: null,
      candidate: null,
      recovery: null,
      tryoutRuntimeBundleJson: null,
    });
    await expect(getStatus(empty)).resolves.toEqual({
      manifestHash: TEST_MANIFEST_HASH,
      phase: "missing",
      releaseId: TEST_RELEASE_ID,
    });

    const candidate = convexTest(schema, convexModules);
    await candidate.mutation((ctx) => insertTestRelease(ctx));
    await expect(candidate.query(currentRelease, {})).resolves.toEqual({
      active: null,
      candidate: {
        phase: "staging",
        releaseJson: testReleaseJson(),
        rendererJson: testRendererJson(),
      },
      recovery: null,
      tryoutRuntimeBundleJson: null,
    });
    await expect(getStatus(candidate)).resolves.toMatchObject({
      phase: "staging",
    });

    const recovery = convexTest(schema, convexModules);
    await recovery.mutation((ctx) =>
      insertTestRelease(ctx, { role: "recovery" })
    );
    await expect(recovery.query(currentRelease, {})).resolves.toMatchObject({
      active: null,
      candidate: null,
      recovery: { phase: "staging" },
      tryoutRuntimeBundleJson: null,
    });
  });

  it("maps verifying, verified, aborting, and detached aborted phases", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestRelease(ctx));

    await t.mutation(async (ctx) => {
      const release = await requireRelease(ctx);
      await ctx.db.patch("contentReleases", release._id, {
        proofFailure: "failed",
        status: "verifying",
      });
    });
    await expect(getStatus(t)).resolves.toMatchObject({ phase: "verifying" });

    await t.mutation(async (ctx) => {
      const release = await requireRelease(ctx);
      await ctx.db.patch("contentReleases", release._id, {
        checkedIndex: 0,
        checkedItems: 1,
        proofAt: 1,
        proofFailure: undefined,
        proofJson: "{}",
        stagedArtifacts: 1,
        stagedItems: 1,
        stagedProjections: 1,
        stagedRoutes: 1,
        stagedUpserts: 1,
        status: "verified",
        verifiedAt: 1,
      });
    });
    await expect(getStatus(t)).resolves.toMatchObject({ phase: "verified" });

    await t.mutation(async (ctx) => {
      const release = await requireRelease(ctx);
      await ctx.db.patch("contentReleases", release._id, {
        abortedRows: 0,
        abortingAt: 1,
        status: "aborting",
      });
    });
    await expect(getStatus(t)).resolves.toMatchObject({ phase: "aborting" });

    await t.mutation(async (ctx) => {
      const release = await requireRelease(ctx);
      const state = await requireState(ctx);
      await ctx.db.patch("contentReleases", release._id, {
        abortedAt: 2,
        abortedRows: 3,
        status: "aborted",
      });
      await ctx.db.patch("contentState", state._id, {
        candidateManifestHash: undefined,
        candidateReleaseId: undefined,
        candidateSequence: undefined,
      });
    });
    await expect(getStatus(t)).resolves.toMatchObject({ phase: "aborted" });
  });

  it("returns exact completed bundles and receipts", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...ACTIVE,
        ownership: {
          base: [],
          result: ContentFamilySchema.literals,
        },
        role: "candidate",
        status: "completed",
      });
      await insertTestState(ctx, { active: ACTIVE, nextSequence: 2 });
    });

    await expect(
      getStatus(t, ACTIVE.manifestHash, ACTIVE.releaseId)
    ).resolves.toMatchObject({
      phase: "completed",
      receipt: { releaseId: ACTIVE.releaseId },
    });
    await expect(t.query(currentRelease, {})).resolves.toMatchObject({
      active: {
        receipt: { releaseId: ACTIVE.releaseId },
        releaseJson: zeroReleaseJson({
          ...ACTIVE,
          role: "candidate",
          status: "completed",
        }),
        rendererJson: testRendererJson(),
      },
      candidate: null,
      recovery: null,
      tryoutRuntimeBundleJson: null,
    });
    await expect(
      getStatus(t, `sha256:${"f".repeat(64)}`, ACTIVE.releaseId)
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("fails closed for incomplete or mismatched singleton identities", async () => {
    const incomplete = convexTest(schema, convexModules);
    await incomplete.mutation((ctx) =>
      ctx.db.insert("contentState", {
        activeReleaseId: ACTIVE.releaseId,
        articleSlot: "blue",
        key: "primary",
        materialSlot: "blue",
        nextSequence: 2,
        searchSlot: "blue",
        updatedAt: 1,
      })
    );
    await expect(incomplete.query(currentRelease, {})).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const mismatched = convexTest(schema, convexModules);
    await mismatched.mutation((ctx) => insertTestRelease(ctx));
    await mismatched.mutation(async (ctx) => {
      const state = await requireState(ctx);
      await ctx.db.patch("contentState", state._id, {
        candidateManifestHash: `sha256:${"f".repeat(64)}`,
      });
    });
    await expect(mismatched.query(currentRelease, {})).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await mismatched.mutation(async (ctx) => {
      const state = await requireState(ctx);
      await ctx.db.patch(state._id, { candidateSequence: 99 });
    });
    await expect(getStatus(mismatched)).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: `Release ${TEST_RELEASE_ID} lost its candidate slot.`,
      },
    });

    const terminal = convexTest(schema, convexModules);
    await terminal.mutation((ctx) => insertTestRelease(ctx));
    await terminal.mutation(async (ctx) => {
      const release = await requireRelease(ctx);
      await ctx.db.patch("contentReleases", release._id, {
        status: "completed",
      });
    });
    await expect(terminal.query(currentRelease, {})).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a stored signed envelope from another release in an owned slot", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestRelease(ctx);
      const release = await requireRelease(ctx);
      await ctx.db.patch(release._id, {
        releaseJson: testReleaseJson({ releaseId: "release-other" }),
      });
    });

    await expect(getStatus(t)).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: `Release ${TEST_RELEASE_ID} lost its signed slot identity.`,
      },
    });
  });
});
