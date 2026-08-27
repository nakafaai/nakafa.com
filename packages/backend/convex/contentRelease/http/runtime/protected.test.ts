// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import type {
  PredecessorObservationArgs,
  PredecessorStatus,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { makeFunctionReference } from "convex/server";

const RUNTIME_TOKEN = "technical-runtime-token";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
const OBSERVATION_ID = "test-predecessor-observation";
const digest = `sha256:${"a".repeat(64)}`;
const request = {
  bundleHash: digest,
  selectors: [
    {
      artifactHash: digest,
      contentKey:
        "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question",
      delivery: "authenticated",
    },
  ],
  snapshotId: digest,
};
type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
const armObservation = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:arm");

/** Sends one request through the registered protected Convex route. */
function post(
  target: RuntimeTest,
  body: BodyInit | null,
  token = RUNTIME_TOKEN
) {
  return target.fetch(PROTECTED_CONTENT_RUNTIME_PATH, {
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

beforeEach(() => {
  process.env[runtimeTokenName] = RUNTIME_TOKEN;
  process.env[polarName] = "technical-webhook-secret";
});

afterEach(() => {
  delete process.env[runtimeTokenName];
  delete process.env[polarName];
});

describe("protected content runtime HTTP route", () => {
  it("returns exact absence for a valid retained-snapshot batch", async () => {
    const target = createConvexTestWithBetterAuth();
    await target.mutation((ctx) => insertRuntimeRelease(ctx));
    await target.mutation(armObservation, { observationId: OBSERVATION_ID });
    const response = await post(target, JSON.stringify(request));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ kind: "missing" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get(CONTENT_RUNTIME_RESPONSE_HEADER)).toBe(
      CONTENT_RUNTIME_RESPONSE_MARKER
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(protectedCount(target)).resolves.toBe(0);
  });

  it("rejects unauthorized, malformed, and oversized requests", async () => {
    const target = createConvexTestWithBetterAuth();
    const unauthorized = await post(
      target,
      JSON.stringify(request),
      "wrong-token"
    );
    const malformed = await post(
      target,
      JSON.stringify({ ...request, selectors: [] })
    );
    const oversized = await post(
      target,
      "x".repeat(MAX_PROTECTED_RUNTIME_REQUEST_BYTES + 1)
    );

    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({
      code: "CONTENT_RUNTIME_UNAUTHORIZED",
    });
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({
      code: "CONTENT_RUNTIME_INVALID",
    });
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toMatchObject({
      code: "CONTENT_RUNTIME_INVALID",
    });
  });
});
