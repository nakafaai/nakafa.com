import {
  getContentRuntimeCacheRevalidationUrl,
  invalidateContentRuntimeCache,
} from "@repo/backend/scripts/sync-content/runtime/cache";
import { ConfigProvider, Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const warningMock = vi.fn();
const successMock = vi.fn();

vi.mock("@repo/backend/scripts/sync-content/cli/logging", () => ({
  /** Records successful invalidation logs without writing to stdout. */
  logSuccess: (message: string) => successMock(message),
  /** Records local development invalidation warnings without writing to stderr. */
  logWarning: (message: string) => warningMock(message),
}));

/** Runs one cache invalidation effect with deterministic script config values. */
const withConfigValues = <A, E>(
  effect: Effect.Effect<A, E, never>,
  values: Map<string, string>
) =>
  Effect.runPromise(
    effect.pipe(Effect.withConfigProvider(ConfigProvider.fromMap(values)))
  );

/** Runs one cache invalidation effect with the internal app credential. */
const withInternalKey = <A, E>(effect: Effect.Effect<A, E, never>) =>
  withConfigValues(effect, new Map([["INTERNAL_CONTENT_API_KEY", "test-key"]]));

/** Runs one cache invalidation effect against a local development app URL. */
const withLocalConfig = <A, E>(effect: Effect.Effect<A, E, never>) =>
  withConfigValues(
    effect,
    new Map([
      ["SITE_URL", "http://localhost:3000"],
      ["INTERNAL_CONTENT_API_KEY", "test-key"],
    ])
  );

afterEach(() => {
  warningMock.mockClear();
  successMock.mockClear();
  vi.unstubAllGlobals();
});

describe("content runtime cache sync invalidation", () => {
  it("builds the protected app invalidation endpoint", () => {
    expect(getContentRuntimeCacheRevalidationUrl("https://nakafa.com")).toBe(
      "https://nakafa.com/api/internal/content/cache"
    );
    expect(getContentRuntimeCacheRevalidationUrl("not-a-url")).toBeUndefined();
  });

  it("requires a development URL and the internal key", async () => {
    await expect(
      withConfigValues(
        invalidateContentRuntimeCache({ prod: false }),
        new Map([["INTERNAL_CONTENT_API_KEY", "test-key"]])
      )
    ).rejects.toThrow(
      "SITE_URL is required to invalidate the content runtime cache."
    );

    await expect(
      withConfigValues(
        invalidateContentRuntimeCache({ prod: true }),
        new Map([["INTERNAL_CONTENT_API_KEY", ""]])
      )
    ).rejects.toThrow(
      "INTERNAL_CONTENT_API_KEY is required to invalidate the content runtime cache."
    );
  });

  it("rejects malformed site URLs before calling the app", async () => {
    await expect(
      withConfigValues(
        invalidateContentRuntimeCache({ prod: false }),
        new Map([
          ["SITE_URL", "not-a-url"],
          ["INTERNAL_CONTENT_API_KEY", "test-key"],
        ])
      )
    ).rejects.toThrow("SITE_URL must be a valid URL");
  });

  it("always invalidates production cache on the canonical app", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null)));
    vi.stubGlobal("fetch", fetchMock);

    await withLocalConfig(invalidateContentRuntimeCache({ prod: true }));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://nakafa.com/api/internal/content/cache",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
      }
    );
    expect(successMock).toHaveBeenCalledWith(
      "Content runtime cache invalidated"
    );
  });

  it("invalidates development cache on the configured app", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null)));
    vi.stubGlobal("fetch", fetchMock);

    await withLocalConfig(invalidateContentRuntimeCache({ prod: false }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/internal/content/cache",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
      }
    );
  });

  it("fails production sync when app cache invalidation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("forbidden", { status: 403 })))
    );

    await expect(
      withInternalKey(invalidateContentRuntimeCache({ prod: true }))
    ).rejects.toThrow("Content runtime cache invalidation failed with 403");
  });

  it("fails production sync when the app endpoint is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("connection refused")))
    );

    await expect(
      withInternalKey(invalidateContentRuntimeCache({ prod: true }))
    ).rejects.toThrow("connection refused");
  });

  it("keeps the non-OK status when the app response body is unreadable", async () => {
    const response = new Response("", { status: 500 });
    Object.defineProperty(response, "text", {
      value: () => Promise.reject(new Error("body unavailable")),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response))
    );

    await expect(
      withInternalKey(invalidateContentRuntimeCache({ prod: true }))
    ).rejects.toThrow("Content runtime cache invalidation failed with 500");
  });

  it("warns instead of failing when a local app is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("connection refused")))
    );

    await withLocalConfig(invalidateContentRuntimeCache({ prod: false }));

    expect(warningMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "Skipped local content runtime cache invalidation"
      )
    );
  });
});
