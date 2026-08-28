// @vitest-environment node

import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PREDECESSOR_PROTECTED_CONTENT_RUNTIME_PATH,
  PREDECESSOR_PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { internal } from "@repo/backend/convex/_generated/api";
import type {
  PredecessorAbandonReceipt,
  PredecessorObservationArgs,
  PredecessorStatus,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { testSignedRelease } from "@repo/backend/test/content/proof";
import {
  testPublicationScope,
  testRendererJson,
} from "@repo/backend/test/content/release";
import {
  insertSignedRelease,
  publicRuntimeRequest,
  runtimeContentKey,
} from "@repo/backend/test/content/runtime";
import { insertZeroRelease } from "@repo/backend/test/content/state";
import { insertRuntimeHead } from "@repo/backend/test/runtime/head";
import { insertProtectedRuntime } from "@repo/backend/test/runtime/protected";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";
import { makeFunctionReference } from "convex/server";
import { Schema } from "effect";

const RUNTIME_TOKEN = "technical-runtime-token";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
const OBSERVATION_ID = "test-predecessor-observation";
const REARMED_OBSERVATION_ID = "test-rearmed-observation";
const digest = `sha256:${"a".repeat(64)}`;
const request = {
  appLocale: "en",
  selectors: [
    {
      artifactHash: digest,
      contentKey:
        "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question",
      delivery: "authenticated",
    },
  ],
  snapshotId: digest,
  snapshotReleaseId: "release-protected-predecessor",
};

type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
const RECOVERY = {
  manifestHash: `sha256:${"9".repeat(64)}`,
  releaseId: "test-recovery-release",
  sequence: TEST_RUNTIME_RELEASE.sequence + 1,
};
const armObservation = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:arm");
const statusObservation = makeFunctionReference<
  "query",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:status");
const sealObservation = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:seal");
const abandonObservation = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorAbandonReceipt
>("contentRelease/predecessor/internal:abandon");

/** Sends one request through the predecessor Convex route. */
function post(t: RuntimeTest, body: BodyInit | null, token = RUNTIME_TOKEN) {
  return t.fetch(PREDECESSOR_PROTECTED_CONTENT_RUNTIME_PATH, {
    body,
    headers: {
      "content-type": "application/json",
      "x-nakafa-content-token": token,
    },
    method: "POST",
  });
}

/** Reads one observer count without scanning the temporary table. */
function protectedCount(target: RuntimeTest) {
  return target.query(async (ctx) => {
    const row = await ctx.db
      .query("contentPredecessorReads")
      .withIndex("by_route", (query) => query.eq("route", "protected"))
      .unique();
    return row?.invocationCount ?? null;
  });
}

/** Sends one request through the public predecessor Convex route. */
function postPublic(t: RuntimeTest, body: BodyInit | null) {
  return t.fetch(PREDECESSOR_PUBLIC_CONTENT_RUNTIME_PATH, {
    body,
    headers: {
      "content-type": "application/json",
      "x-nakafa-content-token": RUNTIME_TOKEN,
    },
    method: "POST",
  });
}

/** Asserts the private response headers shared by predecessor routes. */
function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get(CONTENT_RUNTIME_RESPONSE_HEADER)).toBe(
    CONTENT_RUNTIME_RESPONSE_MARKER
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}

/** Seeds one active public release compatible with the predecessor view. */
function seedPublicRuntime(t: RuntimeTest) {
  return t.mutation(async (ctx) => {
    await insertSignedRelease(ctx);
    await insertRuntimeHead(ctx, "public", runtimeContentKey("public"));
  });
}

/** Activates the exact retained inverse through the production mutation. */
async function recoverRuntime(t: RuntimeTest) {
  await t.mutation(async (ctx) => {
    await insertZeroRelease(ctx, {
      ...RECOVERY,
      base: TEST_RUNTIME_RELEASE,
      originReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      ownership: { base: ContentFamilySchema.literals, result: [] },
      role: "recovery",
      scope: { content: [], ...testPublicationScope() },
      status: "verified",
    });
    const state = await ctx.db.query("contentState").unique();
    if (!state) {
      throw new Error("Expected active content state.");
    }
    await ctx.db.patch("contentState", state._id, {
      recoveryManifestHash: RECOVERY.manifestHash,
      recoveryReleaseId: RECOVERY.releaseId,
      recoverySequence: RECOVERY.sequence,
    });
  });
  await t.mutation(internal.contentRelease.activate.activateRecovery, {
    manifestHash: RECOVERY.manifestHash,
    releaseId: RECOVERY.releaseId,
    rendererJson: testRendererJson(),
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

/** Returns the current singular predecessor invocation count. */
async function singularCount(t: RuntimeTest) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("contentPredecessorReads")
      .withIndex("by_route", (query) => query.eq("route", "singular"))
      .unique()
  );
  return row?.invocationCount ?? null;
}

beforeEach(() => {
  process.env[runtimeTokenName] = RUNTIME_TOKEN;
  process.env[polarName] = "technical-webhook-secret";
});

afterEach(() => {
  delete process.env[runtimeTokenName];
  delete process.env[polarName];
});

describe("public predecessor observation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("records authenticated calls before dispatch", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    await t.mutation(armObservation, { observationId: OBSERVATION_ID });

    const unauthorized = await t.fetch(
      PREDECESSOR_PUBLIC_CONTENT_RUNTIME_PATH,
      {
        body: publicRuntimeRequest(),
        headers: {
          "content-type": "application/json",
          "x-nakafa-content-token": "wrong-token",
        },
        method: "POST",
      }
    );
    expect(unauthorized.status).toBe(401);
    await expect(singularCount(t)).resolves.toBe(0);

    const malformed = await postPublic(t, "{");
    expect(malformed.status).toBe(400);
    await expect(singularCount(t)).resolves.toBe(1);

    const predecessor = await postPublic(t, publicRuntimeRequest());
    expect(predecessor.status).toBe(200);
    await expect(singularCount(t)).resolves.toBe(2);

    await recoverRuntime(t);
    const driftedStatus = {
      kind: "drifted",
      live: RECOVERY,
      stored: TEST_RUNTIME_RELEASE,
    };
    await expect(
      t.query(statusObservation, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject(driftedStatus);
    await expect(
      t.mutation(armObservation, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject(driftedStatus);
    await expect(
      t.mutation(sealObservation, { observationId: OBSERVATION_ID })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

    const drifted = await postPublic(t, publicRuntimeRequest());
    expect(drifted.status).toBe(200);
    await expect(drifted.json()).resolves.toMatchObject({ kind: "found" });
    await expect(singularCount(t)).resolves.toBe(2);
    expectPrivate(drifted);

    await expect(
      t.mutation(abandonObservation, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      abandonedAt: expect.any(Number),
      deleted: 4,
      deploymentName: "test",
      kind: "abandoned",
      live: RECOVERY,
      observationId: OBSERVATION_ID,
      routes: {
        batch: { invocationCount: 0, phase: "armed" },
        singular: { invocationCount: 2, phase: "armed" },
      },
      stored: TEST_RUNTIME_RELEASE,
    });
    await expect(singularCount(t)).resolves.toBeNull();
    await expect(
      t.mutation(armObservation, {
        observationId: REARMED_OBSERVATION_ID,
      })
    ).resolves.toMatchObject({
      active: RECOVERY,
      kind: "active",
      observationId: REARMED_OBSERVATION_ID,
    });
    const rearmed = await postPublic(t, publicRuntimeRequest());
    expect(rearmed.status).toBe(200);
    await expect(singularCount(t)).resolves.toBe(1);
  });
});

describe("predecessor protected content runtime HTTP route", () => {
  it("records authenticated predecessor requests before dispatch", async () => {
    const target = createConvexTestWithBetterAuth();
    const fixture = await target.mutation(insertProtectedRuntime);
    await target.mutation(armObservation, { observationId: OBSERVATION_ID });

    const response = await post(target, JSON.stringify(fixture.predecessor));

    expect(response.status).toBe(200);
    await expect(protectedCount(target)).resolves.toBe(1);
  });

  it("serves a permanent bundle after the legacy bundle is removed", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(insertProtectedRuntime);
    await t.mutation((ctx) => ctx.db.delete(fixture.legacyId));
    const response = await post(t, JSON.stringify(fixture.predecessor));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [
        {
          artifact: { artifactHash: fixture.question.artifactHash },
          delivery: "authenticated",
        },
        {
          artifact: { artifactHash: fixture.answer.artifactHash },
          delivery: "entitled",
        },
      ],
      kind: "found",
      release: {
        manifest: { releaseId: fixture.predecessor.snapshotReleaseId },
      },
      rendererManifest: { hash: expect.any(String) },
      snapshotId: fixture.snapshotId,
      snapshotManifestHash: expect.any(String),
      snapshotReleaseId: fixture.predecessor.snapshotReleaseId,
    });

    const mismatch = await post(
      t,
      JSON.stringify({ ...fixture.predecessor, appLocale: "id" })
    );
    expect(mismatch.status).toBe(500);
    await expect(mismatch.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_INTERNAL",
      kind: "failure",
    });
  });

  it("serves a permanent pair reused by a later release", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(insertProtectedRuntime);
    const reusedReleaseId = ReleaseIdSchema.make("release-protected-reused");
    await t.mutation(async (ctx) => {
      await ctx.db.delete(fixture.legacyId);
      const stored = await ctx.db.query("contentReleases").unique();
      assert.ok(stored);
      const source = Schema.decodeUnknownSync(SignedContentReleaseSchema)(
        JSON.parse(stored.releaseJson)
      );
      const reused = testSignedRelease({
        ...source.manifest,
        releaseId: reusedReleaseId,
      });
      await ctx.db.patch("contentReleases", stored._id, {
        releaseId: reusedReleaseId,
        releaseJson: JSON.stringify(reused),
      });
    });

    const response = await post(
      t,
      JSON.stringify({
        ...fixture.predecessor,
        snapshotReleaseId: reusedReleaseId,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      kind: "found",
      release: { manifest: { releaseId: reusedReleaseId } },
      snapshotId: fixture.snapshotId,
      snapshotReleaseId: reusedReleaseId,
    });
  });

  it("serves the legacy bundle without a permanent runtime row", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(insertProtectedRuntime);
    await t.mutation((ctx) => ctx.db.delete(fixture.runtimeId));
    const response = await post(t, JSON.stringify(fixture.predecessor));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [
        {
          artifact: { artifactHash: fixture.question.artifactHash },
          delivery: "authenticated",
        },
        {
          artifact: { artifactHash: fixture.answer.artifactHash },
          delivery: "entitled",
        },
      ],
      kind: "found",
      snapshotId: fixture.snapshotId,
      snapshotReleaseId: fixture.predecessor.snapshotReleaseId,
    });
  });

  it("returns exact absence for the deployed request contract", async () => {
    const t = createConvexTestWithBetterAuth();
    const response = await post(t, JSON.stringify(request));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ kind: "missing" });
    expectPrivate(response);
  });

  it("rejects unauthorized, successor, and oversized requests", async () => {
    const t = createConvexTestWithBetterAuth();
    const unauthorized = await post(t, JSON.stringify(request), "wrong-token");
    const successor = await post(
      t,
      JSON.stringify({
        bundleHash: digest,
        selectors: request.selectors,
        snapshotId: digest,
      })
    );
    const oversized = await post(
      t,
      "x".repeat(MAX_PROTECTED_RUNTIME_REQUEST_BYTES + 1)
    );

    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({
      code: "CONTENT_RUNTIME_UNAUTHORIZED",
    });
    expect(successor.status).toBe(400);
    await expect(successor.json()).resolves.toMatchObject({
      code: "CONTENT_RUNTIME_INVALID",
    });
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toMatchObject({
      code: "CONTENT_RUNTIME_INVALID",
    });
  });
});
