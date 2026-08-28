// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES } from "@repo/backend/content/batch";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  TRANSITION_PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
} from "@repo/backend/content/endpoint";
import { internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  insertRuntimeRelease,
  publicRuntimeRequest,
  runtimeContentKey,
} from "@repo/backend/test/content/runtime";
import { insertRuntimeHead } from "@repo/backend/test/runtime/head";

const RUNTIME_TOKEN = "technical-runtime-token";
const OBSERVATION_ID = "batch-transition-test";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
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

beforeEach(() => {
  process.env[runtimeTokenName] = RUNTIME_TOKEN;
  process.env[polarName] = "technical-webhook-secret";
});

afterEach(() => {
  delete process.env[runtimeTokenName];
  delete process.env[polarName];
});

describe("public content runtime batch HTTP route", () => {
  it("serves current batches on canonical and transition paths", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    await t.mutation(internal.contentRelease.predecessor.internal.arm, {
      observationId: OBSERVATION_ID,
    });
    const body = JSON.stringify({ requests: [foundRequest, missingRequest] });

    const responses = await Promise.all(
      [
        PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
        TRANSITION_PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
      ].map((path) => post(t, body, undefined, path))
    );
    const bodies = await Promise.all(
      responses.map((response) => response.json())
    );
    const found = bodies[0].responses[0];

    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect(bodies[0]).toEqual(bodies[1]);
    expect(found.projection.metadata).toHaveProperty("datePublished");
    expect(found.projection.metadata).not.toHaveProperty("date");
    expect(bodies[0].responses[1]).toEqual({ kind: "missing" });
    await expect(
      t.query(internal.contentRelease.predecessor.internal.status, {
        observationId: OBSERVATION_ID,
      })
    ).resolves.toMatchObject({
      routes: { batch: { invocationCount: 1 } },
    });
    responses.forEach(expectPrivate);
  });

  it("authenticates both batch paths before consuming request bodies", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedPublicRuntime(t);
    await t.mutation(internal.contentRelease.predecessor.internal.arm, {
      observationId: OBSERVATION_ID,
    });
    let pulls = 0;
    const responses = await Promise.all(
      [
        PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
        TRANSITION_PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
      ].map((path) => {
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
        return t.fetch(path, request);
      })
    );

    expect(responses.map(({ status }) => status)).toEqual([401, 401]);
    expect(pulls).toBe(0);
    await expect(
      t.query(internal.contentRelease.predecessor.internal.status, {
        observationId: OBSERVATION_ID,
      })
    ).resolves.toMatchObject({
      routes: { batch: { invocationCount: 0 } },
    });
    responses.forEach(expectPrivate);
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
        return expect.fail("Expected one runtime head.");
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
