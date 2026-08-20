import { verifyNakafaContent } from "@repo/backend/client/nakafa/verify";
import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { toRuntimeQueryError } from "@repo/backend/test/runtime-query";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { vi } from "vitest";

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

const convexUrl = "https://example.convex.cloud";
const quranRef = readNakafaContentRefFixture("en", "quran/1", "quran");

describe("verifyNakafaContent", () => {
  beforeEach(() => {
    runtimeMocks.runtimeQuery.mockReset();
  });

  it.live("returns false without a query for unsupported references", () =>
    Effect.gen(function* () {
      const result = yield* verifyNakafaContent(convexUrl, "quran/1");

      expect(result).toBe(false);
      expect(runtimeMocks.runtimeQuery).not.toHaveBeenCalled();
    })
  );

  it.live(
    "returns false when no current signed family owns a canonical route",
    () =>
      Effect.gen(function* () {
        runtimeMocks.runtimeQuery.mockResolvedValueOnce(null);

        expect(
          yield* verifyNakafaContent(convexUrl, "https://nakafa.com/en/quran/1")
        ).toBe(false);
      })
  );

  it.live("returns true when the current signed reference exists", () =>
    Effect.gen(function* () {
      runtimeMocks.runtimeQuery.mockResolvedValueOnce(quranRef);

      expect(
        yield* verifyNakafaContent(convexUrl, "https://nakafa.com/en/quran/1")
      ).toBe(true);
    })
  );

  it.live("preserves typed runtime read failures", () =>
    Effect.gen(function* () {
      const runtimeError = new ConvexRuntimeQueryError({
        networkCodes: ["EPIPE"],
        query: "contentRelease.reference.read",
        reason: "transport",
      });
      runtimeMocks.runtimeQuery.mockRejectedValueOnce(runtimeError);

      const error = yield* verifyNakafaContent(
        convexUrl,
        "https://nakafa.com/en/quran/1"
      ).pipe(Effect.flip);

      expect(error).toBeInstanceOf(NakafaAgentDataReadError);
      expect(error).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        cause: runtimeError.message,
      });
    })
  );
});
