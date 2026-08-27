// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PREDECESSOR_RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
  RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import type {
  PredecessorObservationArgs,
  PredecessorStatus,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { makeFunctionReference } from "convex/server";

const runtimeToken = "retained-runtime-token";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
const OBSERVATION_ID = "test-predecessor-observation";
const digest = `sha256:${"a".repeat(64)}`;
const request = {
  appLocale: "en",
  attemptId: "missing-retained-attempt",
  selectors: [
    {
      artifactHash: digest,
      artifactLocale: "en",
      contentKey:
        "question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/question",
      delivery: "authenticated",
    },
  ],
  snapshotId: digest,
  snapshotReleaseId: "retained-runtime-release",
};
type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;
const armObservation = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:arm");

/** Sends one request through the registered retained-history route. */
function post(
  target: RuntimeTest,
  body: BodyInit | null,
  token = runtimeToken,
  path = RETAINED_PROTECTED_CONTENT_RUNTIME_PATH
) {
  return target.fetch(path, {
    body,
    headers: {
      "content-type": "application/json",
      "x-nakafa-content-token": token,
    },
    method: "POST",
  });
}

/** Reads one observer count without scanning the temporary table. */
function historyCount(target: RuntimeTest) {
  return target.query(async (ctx) => {
    const row = await ctx.db
      .query("contentPredecessorReads")
      .withIndex("by_route", (query) => query.eq("route", "history"))
      .unique();
    return row?.invocationCount ?? null;
  });
}

beforeEach(() => {
  process.env[runtimeTokenName] = runtimeToken;
  process.env[polarName] = "technical-webhook-secret";
});

afterEach(() => {
  delete process.env[runtimeTokenName];
  delete process.env[polarName];
});

describe("retained protected content runtime HTTP route", () => {
  it("serves both rollout paths through the exact retained contract", async () => {
    const target = createConvexTestWithBetterAuth();
    await target.mutation((ctx) => insertRuntimeRelease(ctx));
    await target.mutation(armObservation, { observationId: OBSERVATION_ID });
    const responses = await Promise.all(
      [
        PREDECESSOR_RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
        RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
      ].map((path) => post(target, JSON.stringify(request), runtimeToken, path))
    );

    for (const response of responses) {
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        appLocale: request.appLocale,
        attemptId: request.attemptId,
        kind: "missing",
      });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get(CONTENT_RUNTIME_RESPONSE_HEADER)).toBe(
        CONTENT_RUNTIME_RESPONSE_MARKER
      );
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
    await expect(historyCount(target)).resolves.toBe(1);
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
