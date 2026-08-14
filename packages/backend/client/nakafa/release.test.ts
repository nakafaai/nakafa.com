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

const ACTIVE_RELEASE = {
  manifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  releaseId: ReleaseIdSchema.make("release-current"),
  sequence: 25,
};

describe("Nakafa release pin", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("reads the complete active publication identity", async () => {
    queryMock.mockReturnValue(Effect.succeed(ACTIVE_RELEASE));

    await expect(
      Effect.runPromise(readNakafaReleasePin("https://example.convex.cloud"))
    ).resolves.toEqual(ACTIVE_RELEASE);
    expect(readNakafaRuntimeQuery).toHaveBeenCalledWith(
      "https://example.convex.cloud",
      expect.anything(),
      {}
    );
  });

  it("rejects a malformed active publication identity", async () => {
    queryMock.mockReturnValue(
      Effect.succeed({ ...ACTIVE_RELEASE, manifestHash: "not-a-hash" })
    );

    await expect(
      Effect.runPromise(
        readNakafaReleasePin("https://example.convex.cloud").pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "NakafaAgentDataReadError",
      message: "Unable to decode the active Nakafa content release.",
    });
  });

  it("accepts stable active and empty publication identities", async () => {
    for (const identity of [ACTIVE_RELEASE, null]) {
      queryMock.mockReturnValue(Effect.succeed(identity));

      await expect(
        Effect.runPromise(
          verifyNakafaReleasePin("https://example.convex.cloud", identity)
        )
      ).resolves.toEqual(identity);
    }
  });

  it.each([
    [
      "manifest hash",
      {
        ...ACTIVE_RELEASE,
        manifestHash: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
      },
    ],
    [
      "release ID",
      { ...ACTIVE_RELEASE, releaseId: ReleaseIdSchema.make("release-next") },
    ],
    ["sequence", { ...ACTIVE_RELEASE, sequence: 26 }],
    ["missing publication", null],
  ])("rejects a changed %s", async (_label, actual) => {
    queryMock.mockReturnValue(Effect.succeed(actual));

    await expect(
      Effect.runPromise(
        verifyNakafaReleasePin(
          "https://example.convex.cloud",
          ACTIVE_RELEASE
        ).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "NakafaAgentDataReadError",
      message: "Unable to complete one release-pinned Nakafa content read.",
    });
  });

  it("rejects activation from an empty publication", async () => {
    queryMock.mockReturnValue(Effect.succeed(ACTIVE_RELEASE));

    await expect(
      Effect.runPromise(
        verifyNakafaReleasePin("https://example.convex.cloud", null).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({
      _tag: "NakafaAgentDataReadError",
      message: "Unable to complete one release-pinned Nakafa content read.",
    });
  });
});

import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
