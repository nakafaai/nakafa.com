import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { verifyNakafaReleasePin } from "@repo/backend/client/nakafa/release";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/client/nakafa/query", () => ({
  fetchNakafaRuntimeQuery: queryMock,
}));

describe("Nakafa release pin", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("accepts one stable active release", async () => {
    queryMock.mockReturnValue(
      Effect.succeed({ releaseId: "release-material" })
    );

    await expect(
      Effect.runPromise(
        verifyNakafaReleasePin(
          "https://example.convex.cloud",
          "release-material"
        )
      )
    ).resolves.toBe("release-material");
    expect(fetchNakafaRuntimeQuery).toHaveBeenCalledWith(
      "https://example.convex.cloud",
      "readActiveContentIdentity",
      expect.anything(),
      {}
    );
  });

  it("rejects null-to-active and active-to-active changes", async () => {
    queryMock
      .mockReturnValueOnce(Effect.succeed({ releaseId: "release-material" }))
      .mockReturnValueOnce(Effect.succeed({ releaseId: "release-next" }));

    for (const expected of [null, "release-material"]) {
      await expect(
        Effect.runPromise(
          verifyNakafaReleasePin("https://example.convex.cloud", expected).pipe(
            Effect.flip
          )
        )
      ).resolves.toMatchObject({
        _tag: "NakafaAgentDataReadError",
        message: "Unable to complete one release-pinned Nakafa content read.",
      });
    }
  });
});
