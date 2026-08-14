import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import {
  readNakafaReleasePin,
  verifyNakafaReleasePin,
} from "@repo/backend/client/nakafa/release";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/client/nakafa/query", () => ({
  readNakafaRuntimeQuery: queryMock,
}));

describe("Nakafa release pin", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("reads the current active release identity", async () => {
    queryMock.mockReturnValue(
      Effect.succeed({ releaseId: "release-material" })
    );

    await expect(
      Effect.runPromise(readNakafaReleasePin("https://example.convex.cloud"))
    ).resolves.toBe("release-material");
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
    expect(readNakafaRuntimeQuery).toHaveBeenCalledWith(
      "https://example.convex.cloud",
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
