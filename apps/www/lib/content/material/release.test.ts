// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MaterialProjectionIdentity } from "@/lib/content/material/decode";
import {
  decodeMaterialReleasePin,
  verifyMaterialReleasePin,
} from "@/lib/content/material/release";

const readActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-active");
const nextReleaseId = ReleaseIdSchema.make("release-next");
const identity: MaterialProjectionIdentity = {
  locale: "en",
  publicPath:
    "subjects/mathematics/function-composition-inverse-function/function-concept",
};

vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: readActiveContentIdentityMock,
}));

beforeEach(() => {
  readActiveContentIdentityMock.mockReset();
});

describe("material release pin", () => {
  it.each([
    ["active release", activeReleaseId],
    ["no active release", null],
  ])("decodes %s", async (_label, actual) => {
    await expect(
      Effect.runPromise(decodeMaterialReleasePin(actual, undefined, identity))
    ).resolves.toBe(actual);
  });

  it("maps malformed release data to the material projection failure", async () => {
    await expect(
      Effect.runPromise(
        decodeMaterialReleasePin("invalid release", undefined, identity).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      ...identity,
    });
  });

  it("rejects a changed active release", async () => {
    await expect(
      Effect.runPromise(
        decodeMaterialReleasePin(nextReleaseId, activeReleaseId, identity).pipe(
          Effect.flip
        )
      )
    ).resolves.toEqual({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: nextReleaseId,
      expectedReleaseId: activeReleaseId,
    });
  });

  it("rechecks the latest active release identity", async () => {
    readActiveContentIdentityMock.mockReturnValueOnce(
      Effect.succeed({
        manifestHash: `sha256:${"a".repeat(64)}`,
        releaseId: activeReleaseId,
        sequence: 3,
      })
    );

    await expect(
      Effect.runPromise(verifyMaterialReleasePin(activeReleaseId, identity))
    ).resolves.toBe(activeReleaseId);
    expect(readActiveContentIdentityMock).toHaveBeenCalledOnce();
  });

  it("preserves an absent active release identity", async () => {
    readActiveContentIdentityMock.mockReturnValueOnce(Effect.succeed(null));

    await expect(
      Effect.runPromise(verifyMaterialReleasePin(null, identity))
    ).resolves.toBeNull();
  });
});
