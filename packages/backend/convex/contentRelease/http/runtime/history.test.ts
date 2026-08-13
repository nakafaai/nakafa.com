// @vitest-environment node

import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const runtimeToken = "retained-runtime-token";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
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

/** Sends one request through the registered retained-history route. */
function post(body: BodyInit | null, token = runtimeToken) {
  const t = createConvexTestWithBetterAuth();
  return t.fetch(RETAINED_PROTECTED_CONTENT_RUNTIME_PATH, {
    body,
    headers: {
      "content-type": "application/json",
      "x-nakafa-content-token": token,
    },
    method: "POST",
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
  it("returns attempt-bound absence with private response controls", async () => {
    const response = await post(JSON.stringify(request));

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
  });

  it("rejects unauthorized, malformed, and oversized requests", async () => {
    const unauthorized = await post(JSON.stringify(request), "wrong-token");
    const malformed = await post(JSON.stringify({ ...request, selectors: [] }));
    const oversized = await post(
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
