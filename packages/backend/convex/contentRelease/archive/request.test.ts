// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
  CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
} from "@repo/backend/content/endpoint";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  claimId,
  clearEnvironment,
  identity,
  post,
  RUNTIME_TOKEN,
  setEnvironment,
  write,
} from "@repo/backend/test/archive";

beforeEach(setEnvironment);

afterEach(() => {
  vi.restoreAllMocks();
  clearEnvironment();
});

describe("content runtime archive requests", () => {
  it("preserves existing discovery and authentication routes", async () => {
    const target = createConvexTestWithBetterAuth();
    const discovery = await target.fetch("/.well-known/openid-configuration", {
      redirect: "manual",
    });
    const session = await target.fetch("/api/auth/get-session");

    expect(discovery.status).toBe(302);
    expect(discovery.headers.get("location")).toBe(
      "/api/auth/convex/.well-known/openid-configuration"
    );
    expect(session.status).toBe(200);
  });

  it("keeps read and producer credentials least-privileged before body reads", async () => {
    const target = createConvexTestWithBetterAuth();
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
    const readCredentialOnWriteRoute = await target.fetch(
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      {
        body,
        duplex: "half",
        headers: {
          "content-type": "application/json",
          "x-nakafa-content-token": RUNTIME_TOKEN,
        },
        method: "POST",
      } as RequestInit & { readonly duplex: "half" }
    );
    const writeCredentialOnReadRoute = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
      JSON.stringify(identity(1)),
      "write"
    );

    expect(readCredentialOnWriteRoute.status).toBe(401);
    expect(writeCredentialOnReadRoute.status).toBe(401);
    expect(pulls).toBe(0);
  });

  it("fails closed on cryptographic and bounded-body failures", async () => {
    const target = createConvexTestWithBetterAuth();
    vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
      new Error("digest unavailable")
    );
    const cryptoFailure = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
      JSON.stringify(identity(1)),
      "read"
    );
    const oversized = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      JSON.stringify({ source: "x".repeat(3000) }),
      "write"
    );
    const unsupported = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      JSON.stringify(identity(1)),
      "write",
      "text/plain"
    );
    const malformed = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      "{",
      "write"
    );
    const invalidEncoding = await post(
      target,
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      new Uint8Array([0xff]),
      "write"
    );
    await target.run(async (ctx) => {
      const expiresAt = Date.now() + 60_000;
      await ctx.db.insert("contentRuntimeArchiveClaims", {
        ...identity(90),
        claimId: claimId(90),
        expiresAt,
      });
      await ctx.db.insert("contentRuntimeArchiveClaims", {
        ...identity(90),
        claimId: claimId(91),
        expiresAt,
      });
    });
    const internalFailure = await write(
      target,
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      { ...identity(90), claimId: claimId(92) }
    );

    expect(cryptoFailure.status).toBe(500);
    expect(oversized.status).toBe(413);
    expect(unsupported.status).toBe(415);
    expect(malformed.status).toBe(400);
    expect(invalidEncoding.status).toBe(400);
    expect(internalFailure.status).toBe(500);
    await expect(internalFailure.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_ARCHIVE_INTERNAL",
    });
  });
});
