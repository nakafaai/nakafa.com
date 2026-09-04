// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  MATERIAL_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";

const RUNTIME_TOKEN = "technical-material-runtime-token";
const runtimeTokenName = "CONTENT_RUNTIME_TOKEN";
const polarName = "POLAR_WEBHOOK_SECRET";
type RuntimeTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Sends one request through the registered cohesive material HTTP route. */
function post(
  target: Pick<RuntimeTest, "fetch">,
  body: BodyInit | null,
  token = RUNTIME_TOKEN
) {
  return target.fetch(MATERIAL_CONTENT_RUNTIME_PATH, {
    body,
    headers: {
      "content-type": "application/json",
      "x-nakafa-content-token": token,
    },
    method: "POST",
  });
}

/** Asserts the private response contract shared by runtime routes. */
function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get(CONTENT_RUNTIME_RESPONSE_HEADER)).toBe(
    CONTENT_RUNTIME_RESPONSE_MARKER
  );
}

beforeEach(() => {
  process.env[runtimeTokenName] = RUNTIME_TOKEN;
  process.env[polarName] = "technical-webhook-secret";
});

afterEach(() => {
  delete process.env[runtimeTokenName];
  delete process.env[polarName];
});

describe("material content runtime HTTP route", () => {
  it("keeps platform discovery and auth handlers reachable beside material", async () => {
    const target = createConvexTestWithBetterAuth();
    const discovery = await target.fetch("/.well-known/openid-configuration");
    const auth = await target.fetch(
      "/api/auth/convex/.well-known/openid-configuration"
    );

    expect(discovery.status).toBe(302);
    expect(discovery.headers.get("location")).toBe(
      "/api/auth/convex/.well-known/openid-configuration"
    );
    expect(auth.status).toBe(200);
    await expect(auth.json()).resolves.toMatchObject({
      authorization_endpoint: expect.any(String),
    });
  });

  it("serves the coherent publication only on the authenticated route", async () => {
    const target = createConvexTestWithBetterAuth();
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    const source = JSON.stringify({
      appLocale: requested.appLocale,
      delivery: "public",
      publicPath: requested.publicPath,
    });

    const response = await post(target, source);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      kind: "found",
      model: { activeReleaseId: "release-test" },
      runtime: {
        kind: "found",
        projection: { publicPath: requested.publicPath },
      },
    });
    expectPrivate(response);
  });

  it("authenticates first and rejects malformed authenticated input", async () => {
    const target = createConvexTestWithBetterAuth();
    const unauthorized = await post(target, "{", "wrong-token");
    const malformed = await post(target, "{");

    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_UNAUTHORIZED",
      kind: "failure",
    });
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({
      code: "CONTENT_RUNTIME_INVALID",
      kind: "failure",
    });
    expectPrivate(unauthorized);
    expectPrivate(malformed);
  });
});
