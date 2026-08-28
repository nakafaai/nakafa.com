// @vitest-environment node
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import {
  decodePublicContentRuntimeRequest,
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
} from "@nakafa/aksara-contracts/runtime/spec";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PREDECESSOR_PUBLIC_CONTENT_RUNTIME_PATH,
  PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { internal } from "@repo/backend/convex/_generated/api";
import type {
  PredecessorAbandonReceipt,
  PredecessorObservationArgs,
  PredecessorStatus,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { testProjectionJson } from "@repo/backend/test/content/material";
import { testRendererJson } from "@repo/backend/test/content/release";
import {
  insertRuntimeRelease,
  publicRuntimeRequest,
  runtimeCases,
  runtimeContentKey,
} from "@repo/backend/test/content/runtime";
import { insertZeroRelease } from "@repo/backend/test/content/state";
import { insertRuntimeHead } from "@repo/backend/test/runtime/head";
import {
  TEST_RUNTIME_PATH,
  TEST_RUNTIME_RELEASE,
} from "@repo/backend/test/runtime/values";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

const RUNTIME_TOKEN = "technical-runtime-token";
const OBSERVATION_ID = "test-predecessor-observation";
const REARMED_OBSERVATION_ID = "test-rearmed-observation";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
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
type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
type RuntimeFetcher = Pick<RuntimeTest, "fetch">;
/** Sends one request through the actual registered Convex HTTP route. */
function post(
  t: RuntimeFetcher,
  body: BodyInit | null,
  headers?: HeadersInit,
  path = PUBLIC_CONTENT_RUNTIME_PATH
) {
  return t.fetch(path, {
    body,
    headers: {
      "content-type": "application/json",
      "x-nakafa-content-token": RUNTIME_TOKEN,
      ...headers,
    },
    method: "POST",
  });
}
/** Asserts the private response headers shared by every route outcome. */
function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  expect(response.headers.get(CONTENT_RUNTIME_RESPONSE_HEADER)).toBe(
    CONTENT_RUNTIME_RESPONSE_MARKER
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}
/** Seeds one active route for an exact stored delivery class. */
function seedRuntime(
  t: RuntimeTest,
  delivery: "authenticated" | "entitled" | "public"
) {
  return t.mutation(async (ctx) => {
    await insertRuntimeRelease(ctx);
    await insertRuntimeHead(ctx, delivery, runtimeContentKey(delivery));
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
  vi.useFakeTimers();
  process.env[runtimeTokenName] = RUNTIME_TOKEN;
  process.env[polarName] = "technical-webhook-secret";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env[runtimeTokenName];
  delete process.env[polarName];
});
describe("public content runtime HTTP route", () => {
  it("routes predecessor and current contracts without changing active identity", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedRuntime(t, "public");

    const [predecessor, current] = await Promise.all([
      post(
        t,
        publicRuntimeRequest(),
        undefined,
        PREDECESSOR_PUBLIC_CONTENT_RUNTIME_PATH
      ),
      post(t, publicRuntimeRequest()),
    ]);
    const predecessorBody = await predecessor.json();
    const currentBody = await current.json();

    expect(predecessor.status).toBe(200);
    expect(current.status).toBe(200);
    expect(predecessorBody.projection.metadata).toHaveProperty("date");
    expect(predecessorBody.projection.metadata).not.toHaveProperty(
      "datePublished"
    );
    expect(currentBody.projection.metadata).toHaveProperty("datePublished");
    expect(currentBody.projection.metadata).not.toHaveProperty("date");
    expect(predecessorBody.projectionHash).not.toBe(currentBody.projectionHash);
    expect(predecessorBody.activeManifestHash).toBe(
      currentBody.activeManifestHash
    );
    expect(predecessorBody.activeReleaseId).toBe(currentBody.activeReleaseId);
    expectPrivate(predecessor);
    expectPrivate(current);
  });

  it("records authenticated bounded predecessor calls before dispatch", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedRuntime(t, "public");
    await t.mutation(armObservation, { observationId: OBSERVATION_ID });

    const unauthorized = await post(
      t,
      publicRuntimeRequest(),
      { "x-nakafa-content-token": "wrong-token" },
      PREDECESSOR_PUBLIC_CONTENT_RUNTIME_PATH
    );
    const current = await post(t, publicRuntimeRequest());
    expect(unauthorized.status).toBe(401);
    expect(current.status).toBe(200);
    await expect(singularCount(t)).resolves.toBe(0);

    const malformed = await post(
      t,
      "{",
      undefined,
      PREDECESSOR_PUBLIC_CONTENT_RUNTIME_PATH
    );
    expect(malformed.status).toBe(400);
    await expect(singularCount(t)).resolves.toBe(1);

    const predecessor = await post(
      t,
      publicRuntimeRequest(),
      undefined,
      PREDECESSOR_PUBLIC_CONTENT_RUNTIME_PATH
    );
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

    const drifted = await post(
      t,
      publicRuntimeRequest(),
      undefined,
      PREDECESSOR_PUBLIC_CONTENT_RUNTIME_PATH
    );
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
    const rearmed = await post(
      t,
      publicRuntimeRequest(),
      undefined,
      PREDECESSOR_PUBLIC_CONTENT_RUNTIME_PATH
    );
    expect(rearmed.status).toBe(200);
    await expect(singularCount(t)).resolves.toBe(1);
  });

  it.each([
    PREDECESSOR_PUBLIC_CONTENT_RUNTIME_PATH,
    PUBLIC_CONTENT_RUNTIME_PATH,
  ])("authenticates before consuming a request body at %s", async (path) => {
    const t = createConvexTestWithBetterAuth();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        /** Records any attempt to consume a request before authentication. */
        pull(controller) {
          pulls += 1;
          controller.error(new Error("Unauthorized body was consumed."));
        },
      },
      { highWaterMark: 0 }
    );
    const request = {
      body,
      duplex: "half",
      headers: {
        "content-type": "application/json",
        "x-nakafa-content-token": "wrong-token",
      },
      method: "POST",
    } satisfies RequestInit & {
      readonly duplex: "half";
    };
    const response = await t.fetch(path, request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_UNAUTHORIZED",
      kind: "failure",
    });
    expect(pulls).toBe(0);
    expectPrivate(response);
  });
  it.each([
    ["{", { "content-type": "application/json" }, 400],
    ["{}", { "content-length": "3" }, 400],
    [publicRuntimeRequest(), { "content-type": "text/plain" }, 415],
    [
      "x".repeat(MAX_PUBLIC_RUNTIME_REQUEST_BYTES + 1),
      { "content-type": "application/json" },
      413,
    ],
    [
      JSON.stringify({
        delivery: "public",
        extra: true,
        appLocale: "en",
        publicPath: TEST_RUNTIME_PATH,
      }),
      { "content-type": "application/json" },
      400,
    ],
  ] as const)(
    "rejects invalid bounded input",
    async (body, headers, status) => {
      const response = await post(
        createConvexTestWithBetterAuth(),
        body,
        headers
      );
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({
        code: "CONTENT_RUNTIME_INVALID",
        kind: "failure",
      });
    }
  );
  it.live(
    "transports evidence for application verification and exact absence",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        yield* Effect.promise(() => seedRuntime(t, "public"));
        const found = yield* Effect.promise(() =>
          post(t, publicRuntimeRequest())
        );
        const missing = yield* Effect.promise(() =>
          post(
            t,
            JSON.stringify({
              delivery: "public",
              appLocale: "en",
              publicPath: "subjects/test/missing",
            })
          )
        );
        expect(found.status).toBe(200);
        const foundBody = yield* Effect.promise(() => found.json());
        expect(foundBody).toMatchObject({ kind: "found" });
        const request = yield* decodePublicContentRuntimeRequest(
          JSON.parse(publicRuntimeRequest())
        );
        const rejected = yield* verifyContentRuntimeExchange({
          rendererManifest: foundBody.rendererManifest,
          request,
          response: foundBody,
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            contentKeyResolver
          ),
          Effect.flip
        );
        expect(rejected._tag).toBe("ReleaseManifestHashMismatchError");
        expect(missing.status).toBe(404);
        yield* Effect.promise(() =>
          expect(missing.json()).resolves.toEqual({ kind: "missing" })
        );
        expectPrivate(found);
      })
  );
  it.live("rejects found rows that do not belong to the exact request", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* Effect.promise(() => seedRuntime(t, "public"));
      const row = yield* Effect.promise(() =>
        t.query(internal.contentRelease.runtime.public.internal.read, {
          appLocale: "en",
          publicPath: TEST_RUNTIME_PATH,
        })
      );
      if (!row) {
        throw new Error("Expected one public runtime row.");
      }
      const request = yield* decodePublicContentRuntimeRequest(
        JSON.parse(publicRuntimeRequest())
      );
      for (const [reason, candidate] of runtimeCases(row)) {
        const result = yield* verifyContentRuntimeExchange({
          rendererManifest: JSON.parse(row.rendererJson),
          request,
          response: candidate,
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            contentKeyResolver
          ),
          Effect.result
        );
        expect(result, reason).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "ContentRuntimeMismatchError", reason },
        });
      }
    })
  );
  it("rejects non-public delivery even when its stored head exists", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedRuntime(t, "authenticated");
    const response = await post(
      t,
      JSON.stringify({
        delivery: "authenticated",
        appLocale: "en",
        publicPath: TEST_RUNTIME_PATH,
      })
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_INVALID",
      kind: "failure",
    });
  });
  it("fails closed for corrupt or oversized runtime state", async () => {
    const corrupt = createConvexTestWithBetterAuth();
    await seedRuntime(corrupt, "public");
    await corrupt.mutation(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        throw new Error("Expected a corruptible runtime head.");
      }
      await ctx.db.patch("contentHeads", head._id, {
        projectionHash: `sha256:${"f".repeat(64)}`,
      });
    });
    const oversized = createConvexTestWithBetterAuth();
    await oversized.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertRuntimeHead(ctx, "public", runtimeContentKey("public"), {
        compiledCode: "x".repeat(MAX_PUBLIC_RUNTIME_RESPONSE_BYTES / 2 + 1),
        projectionJson: testProjectionJson({
          contentKey: runtimeContentKey("public"),
          publicPath: TEST_RUNTIME_PATH,
          title: "x".repeat(MAX_PUBLIC_RUNTIME_RESPONSE_BYTES / 2 + 1),
        }),
      });
    });
    const corruptResponse = await post(corrupt, publicRuntimeRequest());
    const oversizedResponse = await post(oversized, publicRuntimeRequest());
    expect(corruptResponse.status).toBe(500);
    expect(oversizedResponse.status).toBe(500);
    expectPrivate(corruptResponse);
    expectPrivate(oversizedResponse);
    await expect(oversizedResponse.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_RESPONSE_TOO_LARGE",
      kind: "failure",
    });
  });
});
