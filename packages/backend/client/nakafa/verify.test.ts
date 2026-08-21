import { verifyNakafaContent } from "@repo/backend/client/nakafa/verify";
import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", async (importOriginal) => ({
  ...(await importOriginal()),
  readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: toRuntimeQueryError,
      try: () => runtimeMocks.runtimeQuery(url, query, args),
    }),
}));

function toRuntimeQueryError(cause: unknown) {
  if (cause instanceof ConvexRuntimeQueryError) {
    return cause;
  }

  return new ConvexRuntimeQueryError({
    networkCodes: [],
    query: "test-runtime-query",
    reason: "query",
  });
}

const convexUrl = "https://example.convex.cloud";
const quranRef = readNakafaContentRefFixture("en", "quran/1", "quran");

describe("verifyNakafaContent", () => {
  beforeEach(() => {
    runtimeMocks.runtimeQuery.mockReset();
  });

  it("returns false without a query for unsupported references", async () => {
    const result = await Effect.runPromise(
      verifyNakafaContent(convexUrl, "quran/1")
    );

    expect(result).toBe(false);
    expect(runtimeMocks.runtimeQuery).not.toHaveBeenCalled();
  });

  it("returns false when no current signed family owns a canonical route", async () => {
    runtimeMocks.runtimeQuery.mockResolvedValueOnce(null);

    await expect(
      Effect.runPromise(
        verifyNakafaContent(convexUrl, "https://nakafa.com/en/quran/1")
      )
    ).resolves.toBe(false);
  });

  it("returns true when the current signed reference exists", async () => {
    runtimeMocks.runtimeQuery.mockResolvedValueOnce(quranRef);

    await expect(
      Effect.runPromise(
        verifyNakafaContent(convexUrl, "https://nakafa.com/en/quran/1")
      )
    ).resolves.toBe(true);
  });

  it("preserves typed runtime read failures", async () => {
    const runtimeError = new ConvexRuntimeQueryError({
      networkCodes: ["EPIPE"],
      query: "contentRelease.reference.read",
      reason: "transport",
    });
    runtimeMocks.runtimeQuery.mockRejectedValueOnce(runtimeError);

    const error = await Effect.runPromise(
      verifyNakafaContent(convexUrl, "https://nakafa.com/en/quran/1").pipe(
        Effect.flip
      )
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
    expect(error).toMatchObject({
      _tag: "NakafaAgentDataReadError",
      cause: runtimeError.message,
    });
  });
});
