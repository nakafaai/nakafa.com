import { beforeEach, describe, expect, it } from "@effect/vitest";
import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import {
  readNakafaReleasePin,
  verifyNakafaReleasePin,
} from "@repo/backend/client/nakafa/release";
import { Effect } from "effect";
import { vi } from "vitest";

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

  it.effect("reads the complete active publication identity", () =>
    Effect.gen(function* () {
      queryMock.mockReturnValue(Effect.succeed(ACTIVE_RELEASE));

      expect(
        yield* readNakafaReleasePin("https://example.convex.cloud")
      ).toEqual(ACTIVE_RELEASE);
      expect(readNakafaRuntimeQuery).toHaveBeenCalledWith(
        "https://example.convex.cloud",
        expect.anything(),
        {}
      );
    })
  );

  it.effect("rejects a malformed active publication identity", () =>
    Effect.gen(function* () {
      queryMock.mockReturnValue(
        Effect.succeed({ ...ACTIVE_RELEASE, manifestHash: "not-a-hash" })
      );

      expect(
        yield* readNakafaReleasePin("https://example.convex.cloud").pipe(
          Effect.flip
        )
      ).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        message: "Unable to decode the active Nakafa content release.",
      });
    })
  );

  it.effect("accepts stable active and empty publication identities", () =>
    Effect.gen(function* () {
      for (const identity of [ACTIVE_RELEASE, null]) {
        queryMock.mockReturnValue(Effect.succeed(identity));

        expect(
          yield* verifyNakafaReleasePin(
            "https://example.convex.cloud",
            identity
          )
        ).toEqual(identity);
      }
    })
  );

  it.effect.each([
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
  ])("rejects a changed %s", ([_label, actual]) =>
    Effect.gen(function* () {
      queryMock.mockReturnValue(Effect.succeed(actual));

      expect(
        yield* verifyNakafaReleasePin(
          "https://example.convex.cloud",
          ACTIVE_RELEASE
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        message: "Unable to complete one release-pinned Nakafa content read.",
      });
    })
  );

  it.effect("rejects activation from an empty publication", () =>
    Effect.gen(function* () {
      queryMock.mockReturnValue(Effect.succeed(ACTIVE_RELEASE));

      expect(
        yield* verifyNakafaReleasePin(
          "https://example.convex.cloud",
          null
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        message: "Unable to complete one release-pinned Nakafa content read.",
      });
    })
  );
});

import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
