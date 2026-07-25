import { verifyNakafaContent } from "@repo/backend/client/nakafa/verify";
import { api } from "@repo/backend/convex/_generated/api";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeMocks.fetchConvexRuntimeQuery,
}));

const convexUrl = "https://example.convex.cloud";
const quranRef = readNakafaContentRefFixture("en", "quran/1", "quran");

describe("verifyNakafaContent", () => {
  beforeEach(() => {
    runtimeMocks.fetchConvexRuntimeQuery.mockReset();
  });

  it("returns false without a query for unsupported references", async () => {
    const result = await Effect.runPromise(
      verifyNakafaContent(convexUrl, "quran/1")
    );

    expect(result).toBe(false);
    expect(runtimeMocks.fetchConvexRuntimeQuery).not.toHaveBeenCalled();
  });

  it("returns false when a canonical route is not present", async () => {
    runtimeMocks.fetchConvexRuntimeQuery.mockResolvedValueOnce(null);

    const result = await Effect.runPromise(
      verifyNakafaContent(convexUrl, "https://nakafa.com/en/quran/1")
    );

    expect(result).toBe(false);
  });

  it("returns false when the resolved content route is no longer active", async () => {
    runtimeMocks.fetchConvexRuntimeQuery
      .mockResolvedValueOnce({ ...quranRef, title: "Al-Fatihah" })
      .mockResolvedValueOnce(null);

    const result = await Effect.runPromise(
      verifyNakafaContent(convexUrl, "https://nakafa.com/en/quran/1")
    );

    expect(result).toBe(false);
  });

  it("returns true when the canonical content route is active", async () => {
    runtimeMocks.fetchConvexRuntimeQuery.mockImplementation(
      (_url: string, query: FunctionReference<"query">) => {
        const name = getFunctionName(query);

        if (
          name ===
            getFunctionName(api.contents.queries.runtime.getContentRoute) ||
          name ===
            getFunctionName(
              api.contents.queries.runtime.getContentRouteByContentId
            )
        ) {
          return Promise.resolve({ ...quranRef, title: "Al-Fatihah" });
        }

        return Promise.reject(new Error(`Unexpected query: ${name}`));
      }
    );

    const result = await Effect.runPromise(
      verifyNakafaContent(convexUrl, "https://nakafa.com/en/quran/1")
    );

    expect(result).toBe(true);
  });

  it("preserves typed runtime read failures instead of returning false", async () => {
    runtimeMocks.fetchConvexRuntimeQuery.mockRejectedValueOnce(
      new Error("runtime unavailable")
    );

    const error = await Effect.runPromise(
      verifyNakafaContent(convexUrl, "https://nakafa.com/en/quran/1").pipe(
        Effect.flip
      )
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
    expect(error).toMatchObject({
      _tag: "NakafaAgentDataReadError",
      cause: "runtime unavailable",
    });
  });
});
