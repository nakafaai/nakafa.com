// @vitest-environment node

import { MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES } from "@repo/backend/content/batch";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PREDECESSOR_PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
} from "@repo/backend/content/endpoint";
import type {
  PredecessorObservationArgs,
  PredecessorStatus,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  insertRuntimeRelease,
  publicRuntimeRequest,
  runtimeContentKey,
} from "@repo/backend/test/content-runtime";
import { insertRuntimeHead } from "@repo/backend/test/runtime-head";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RUNTIME_TOKEN = "technical-runtime-token";
const OBSERVATION_ID = "dates-cutover-4974ee8c";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
const armObservation = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:arm");
const foundRequest = JSON.parse(publicRuntimeRequest());
const missingRequest = {
  appLocale: "en",
  delivery: "public",
  publicPath: "test/missing",
};

type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
type RuntimeFetcher = Pick<RuntimeTest, "fetch">;

/** Sends one batch through the actual registered Convex HTTP route. */
function post(
  t: RuntimeFetcher,
  body: BodyInit | null,
  headers?: HeadersInit,
  path = PUBLIC_CONTENT_RUNTIME_BATCH_PATH
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

/** Asserts the private response headers shared by every batch outcome. */
function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get(CONTENT_RUNTIME_RESPONSE_HEADER)).toBe(
    CONTENT_RUNTIME_RESPONSE_MARKER
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}

/** Seeds one active public runtime route. */
function seedPublicRuntime(t: RuntimeTest) {
  return t.mutation(async (ctx) => {
    await insertRuntimeRelease(ctx);
    await insertRuntimeHead(ctx, "public", runtimeContentKey("public"));
  });
}

/** Returns the current batch predecessor invocation count. */
async function batchCount(t: RuntimeTest) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("contentPredecessorReads")
      .withIndex("by_route", (query) => query.eq("route", "batch"))
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

describe("public content runtime batch HTTP route", () => {
  it("routes predecessor and current batches without changing active identity", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    const body = JSON.stringify({ requests: [foundRequest, missingRequest] });

    const [predecessor, current] = await Promise.all([
      post(t, body, undefined, PREDECESSOR_PUBLIC_CONTENT_RUNTIME_BATCH_PATH),
      post(t, body),
    ]);
    const predecessorBody = await predecessor.json();
    const currentBody = await current.json();
    const predecessorFound = predecessorBody.responses[0];
    const currentFound = currentBody.responses[0];

    expect(predecessor.status).toBe(200);
    expect(current.status).toBe(200);
    expect(predecessorFound.projection.metadata).toHaveProperty("date");
    expect(predecessorFound.projection.metadata).not.toHaveProperty(
      "datePublished"
    );
    expect(currentFound.projection.metadata).toHaveProperty("datePublished");
    expect(currentFound.projection.metadata).not.toHaveProperty("date");
    expect(predecessorFound.projectionHash).not.toBe(
      currentFound.projectionHash
    );
    expect(predecessorFound.activeManifestHash).toBe(
      currentFound.activeManifestHash
    );
    expect(predecessorFound.activeReleaseId).toBe(currentFound.activeReleaseId);
    expect(predecessorBody.responses[1]).toEqual({ kind: "missing" });
    expect(currentBody.responses[1]).toEqual({ kind: "missing" });
    expectPrivate(predecessor);
    expectPrivate(current);
  });

  it("records authenticated bounded predecessor batches before dispatch", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    await t.mutation(armObservation, { observationId: OBSERVATION_ID });
    const body = JSON.stringify({ requests: [foundRequest] });

    const unauthorized = await post(
      t,
      body,
      { "x-nakafa-content-token": "wrong-token" },
      PREDECESSOR_PUBLIC_CONTENT_RUNTIME_BATCH_PATH
    );
    const current = await post(t, body);
    expect(unauthorized.status).toBe(401);
    expect(current.status).toBe(200);
    await expect(batchCount(t)).resolves.toBe(0);

    const malformed = await post(
      t,
      "{",
      undefined,
      PREDECESSOR_PUBLIC_CONTENT_RUNTIME_BATCH_PATH
    );
    expect(malformed.status).toBe(400);
    await expect(batchCount(t)).resolves.toBe(1);

    const predecessor = await post(
      t,
      body,
      undefined,
      PREDECESSOR_PUBLIC_CONTENT_RUNTIME_BATCH_PATH
    );
    expect(predecessor.status).toBe(200);
    await expect(batchCount(t)).resolves.toBe(2);

    await t.mutation(async (ctx) => {
      const rows = await ctx.db.query("contentPredecessorReads").collect();
      for (const row of rows) {
        await ctx.db.patch("contentPredecessorReads", row._id, {
          deploymentName: "other-deployment",
        });
      }
    });
    const mismatched = await post(
      t,
      body,
      undefined,
      PREDECESSOR_PUBLIC_CONTENT_RUNTIME_BATCH_PATH
    );
    expect(mismatched.status).toBe(500);
    await expect(mismatched.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_INTERNAL",
      kind: "failure",
    });
    await expect(batchCount(t)).resolves.toBe(2);
    expectPrivate(mismatched);
  });

  it.each([
    PREDECESSOR_PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
    PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  ])("authenticates before consuming the request body at %s", async (path) => {
    const t = createConvexTestWithBetterAuth();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
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
    } satisfies RequestInit & { readonly duplex: "half" };
    const response = await t.fetch(path, request);

    expect(response.status).toBe(401);
    expect(pulls).toBe(0);
    expectPrivate(response);
  });

  it("returns eight ordered found and missing responses", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    const requests = [
      foundRequest,
      missingRequest,
      ...Array.from({ length: 6 }, () => foundRequest),
    ];

    const response = await post(t, JSON.stringify({ requests }));

    expect(response.status).toBe(200);
    expectPrivate(response);
    const body = await response.json();
    expect(body.responses).toHaveLength(8);
    expect(body.responses.map(({ kind }: { kind: string }) => kind)).toEqual([
      "found",
      "missing",
      "found",
      "found",
      "found",
      "found",
      "found",
      "found",
    ]);
  });

  it("rejects nine items and a body above the complete batch ceiling", async () => {
    const t = createConvexTestWithBetterAuth();
    const overCount = await post(
      t,
      JSON.stringify({
        requests: Array.from({ length: 9 }, () => foundRequest),
      })
    );
    const overBytes = await post(
      t,
      "x".repeat(MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES + 1)
    );

    expect(overCount.status).toBe(400);
    expect(overBytes.status).toBe(413);
    await expect(overCount.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_INVALID",
      kind: "failure",
    });
  });

  it("returns one sanitized failure when any stored item is corrupt", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    await t.mutation(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        throw new Error("Expected one runtime head.");
      }
      await ctx.db.patch("contentHeads", head._id, {
        projectionHash: `sha256:${"f".repeat(64)}`,
      });
    });

    const response = await post(
      t,
      JSON.stringify({ requests: [foundRequest] })
    );

    expect(response.status).toBe(500);
    expectPrivate(response);
    await expect(response.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_INTERNAL",
      kind: "failure",
    });
  });
});
