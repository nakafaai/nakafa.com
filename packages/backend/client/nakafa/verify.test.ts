import { verifyNakafaContent } from "@repo/backend/client/nakafa/verify";
import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import {
  makeMaterialContentRef,
  makeMaterialProjection,
} from "@repo/backend/test/content-material";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", async (importOriginal) => ({
  ...(await importOriginal()),
  readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: () => runtimeMocks.runtimeQuery(url, query, args),
    }),
}));

const convexUrl = "https://example.convex.cloud";
const quranRef = readNakafaContentRefFixture("en", "quran/1", "quran");
const materialRef = makeMaterialContentRef(makeMaterialProjection("en", 1));

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

  it("returns false when a canonical route is not present", async () => {
    runtimeMocks.runtimeQuery.mockResolvedValueOnce(null);

    const result = await Effect.runPromise(
      verifyNakafaContent(convexUrl, "https://nakafa.com/en/quran/1")
    );

    expect(result).toBe(false);
  });

  it("returns false when the resolved content route is no longer active", async () => {
    runtimeMocks.runtimeQuery
      .mockResolvedValueOnce({ ...quranRef, title: "Al-Fatihah" })
      .mockResolvedValueOnce(null);

    const result = await Effect.runPromise(
      verifyNakafaContent(convexUrl, "https://nakafa.com/en/quran/1")
    );

    expect(result).toBe(false);
  });

  it("returns true when the canonical content route is active", async () => {
    runtimeMocks.runtimeQuery.mockImplementation(
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

  it.each([materialRef.content_id, materialRef.url])(
    "verifies exact material ownership for %s",
    async (input) => {
      runtimeMocks.runtimeQuery
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          activeReleaseId: "release-material",
          managed: true,
          route: {
            locale: materialRef.locale,
            publicPath: "materials/mathematics/functions/function-concept",
          },
        });

      const result = await Effect.runPromise(
        verifyNakafaContent(convexUrl, input)
      );

      expect(result).toBe(true);
      expect(runtimeMocks.runtimeQuery).toHaveBeenLastCalledWith(
        convexUrl,
        api.contentRelease.material.lookup,
        expect.anything()
      );
    }
  );

  it("rejects source material verification after a release activates", async () => {
    runtimeMocks.runtimeQuery
      .mockResolvedValueOnce(materialRef)
      .mockResolvedValueOnce({
        activeReleaseId: null,
        managed: false,
        route: null,
      })
      .mockResolvedValueOnce(materialRef)
      .mockResolvedValueOnce({ releaseId: "release-material" });

    await expect(
      Effect.runPromise(
        verifyNakafaContent(convexUrl, materialRef.content_id).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "NakafaAgentDataReadError",
      message: "Unable to complete one release-pinned Nakafa content read.",
    });
  });

  it("preserves typed runtime read failures instead of returning false", async () => {
    const runtimeError = new ConvexRuntimeQueryError({
      networkCodes: ["EPIPE"],
      query: "contentRelease.quran.markdown",
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
