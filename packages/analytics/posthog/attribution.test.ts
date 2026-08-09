import { beforeEach, describe, expect, it, vi } from "vitest";

const attributionMocks = vi.hoisted(() => ({
  keys: vi.fn(() => ({
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    POSTHOG_PROXY_HOST: "https://t.nakafa.com",
  })),
}));

vi.mock("@repo/analytics/keys", () => ({
  keys: attributionMocks.keys,
}));

vi.mock("server-only", () => ({}));

describe("PostHog cookie attribution", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns no identity for absent, unrelated, or malformed cookies", async () => {
    const { extractDistinctIdFromPostHogCookie } = await import(
      "@repo/analytics/posthog/attribution"
    );
    const cookieName = "ph_phc_test_posthog";

    expect(extractDistinctIdFromPostHogCookie(undefined)).toBeUndefined();
    expect(extractDistinctIdFromPostHogCookie("other=value")).toBeUndefined();
    expect(
      extractDistinctIdFromPostHogCookie(`${cookieName}=%`)
    ).toBeUndefined();
    expect(
      extractDistinctIdFromPostHogCookie(
        `${cookieName}=${encodeURIComponent(JSON.stringify({ distinct_id: 1 }))}`
      )
    ).toBeUndefined();
  });

  it("extracts the browser distinct id from string and array headers", async () => {
    const { extractDistinctIdFromPostHogCookie } = await import(
      "@repo/analytics/posthog/attribution"
    );
    const cookie = `ph_phc_test_posthog=${encodeURIComponent(
      JSON.stringify({ distinct_id: "viewer-2" })
    )}`;

    expect(extractDistinctIdFromPostHogCookie(cookie)).toBe("viewer-2");
    expect(extractDistinctIdFromPostHogCookie(["other=value", cookie])).toBe(
      "viewer-2"
    );
  });
});
