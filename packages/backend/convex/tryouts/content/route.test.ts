// @vitest-environment node

import { MAX_TRYOUT_CONTENT_REQUEST_BYTES } from "@repo/backend/content/tryout";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const PATH = "/internal/tryouts/content";
const RUNTIME_TOKEN = "tryout-runtime-token";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
const request = JSON.stringify({
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id",
  sectionKey: "penalaran-matematika",
  setKey: "set-1",
  trackKey: "2027",
});

type TryoutTest = ReturnType<typeof createConvexTestWithBetterAuth>;
type TryoutFetcher = Pick<TryoutTest, "fetch">;

/** Posts one private try-out content request through the actual HTTP router. */
function post(
  t: TryoutFetcher,
  body: BodyInit | null = request,
  headers?: HeadersInit
) {
  const init = {
    body,
    duplex: "half",
    headers: {
      "content-type": "application/json",
      "x-nakafa-content-token": RUNTIME_TOKEN,
      ...headers,
    },
    method: "POST",
  } satisfies RequestInit & { readonly duplex: "half" };
  return t.fetch(PATH, init);
}

/** Asserts the route never exposes cacheable or browser-readable content. */
function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}

beforeEach(() => {
  process.env[runtimeTokenName] = RUNTIME_TOKEN;
  process.env[polarName] = "technical-webhook-secret";
});

afterEach(() => {
  delete process.env[runtimeTokenName];
  delete process.env[polarName];
});

describe("try-out content HTTP route", () => {
  it("checks the server token before consuming hostile request bytes", async () => {
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
    const response = await post(t, body, {
      "x-nakafa-content-token": "wrong-token",
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "TRYOUT_CONTENT_UNAUTHORIZED",
      kind: "failure",
    });
    expect(pulls).toBe(0);
    expectPrivate(response);
  });

  it("requires a valid user session before consuming request bytes", async () => {
    const t = createConvexTestWithBetterAuth();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls += 1;
          controller.error(new Error("Unauthenticated body was consumed."));
        },
      },
      { highWaterMark: 0 }
    );
    const response = await post(t, body);

    expect(response.status).toBe(401);
    expect(pulls).toBe(0);
    expectPrivate(response);
  });

  it("returns exact unavailable for an authenticated user without an attempt", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: Date.now(),
        suffix: "tryout-content-route",
      })
    );
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const response = await post(authed);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ kind: "unavailable" });
    expectPrivate(response);
  });

  it.each([
    ["{", { "content-type": "application/json" }, 400],
    [request, { "content-type": "text/plain" }, 415],
    [
      "x".repeat(MAX_TRYOUT_CONTENT_REQUEST_BYTES + 1),
      { "content-type": "application/json" },
      413,
    ],
  ] as const)("rejects bounded input after both authentication checks", async (body, headers, status) => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: Date.now(),
        suffix: `tryout-content-${status}`,
      })
    );
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const response = await post(authed, body, headers);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      code: "TRYOUT_CONTENT_INVALID",
      kind: "failure",
    });
  });
});
