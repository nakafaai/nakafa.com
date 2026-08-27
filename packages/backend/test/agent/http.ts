import { expect, vi } from "@effect/vitest";
import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import type { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";

export const API_SECRET = "technical-api-edge-secret";

const PROBLEM_TYPE_PATTERN = /^https:\/\/nakafa\.com\/problems\//u;

type BackendTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Sends one request through the real Convex router and edge guard. */
export function fetchApi(
  test: BackendTest,
  path: string,
  init: RequestInit = {},
  address = "203.0.113.4"
) {
  const headers = new Headers(init.headers);
  headers.set(NAKAFA_API_EDGE_CONTRACT.secretHeader, API_SECRET);
  headers.set("x-forwarded-for", address);
  return test.fetch(`${NAKAFA_API_EDGE_CONTRACT.originPath}${path}`, {
    ...init,
    headers,
  });
}

/** Asserts the public API response metadata shared by JSON outcomes. */
export function expectPublicJson(response: Response) {
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("vary")).toContain("Accept");
  expect(response.headers.get("vary")).toContain("Accept-Encoding");
}

/** Asserts one traceable RFC 9457 response without fixing its request ID. */
export async function expectProblem(
  response: Response,
  expected: { readonly code: string; readonly status: number }
) {
  expect(response.status).toBe(expected.status);
  expect(response.headers.get("content-type")).toBe(
    "application/problem+json; charset=utf-8"
  );
  if (expected.status === 405) {
    expect(response.headers.get("allow")).toBe("GET, OPTIONS");
  }
  expectPublicJson(response);
  await expect(response.json()).resolves.toMatchObject({
    code: expected.code,
    request_id: expect.any(String),
    status: expected.status,
    type: expect.stringMatching(PROBLEM_TYPE_PATTERN),
  });
}

/** Installs the private origin credential used by the real edge guard. */
export function stubApiSecret() {
  vi.stubEnv(NAKAFA_API_EDGE_CONTRACT.secretEnvironment, API_SECRET);
}

/** Restores the process environment after an API integration test. */
export function restoreApiSecret() {
  vi.unstubAllEnvs();
}
