// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MaterialProjectionIdentity } from "@/lib/content/material/decode";
import {
  decodeMaterialReleasePin,
  verifyMaterialReleasePin,
  verifyStaticMaterialReleasePin,
} from "@/lib/content/material/release";

const fetchActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const readActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-active");
const nextReleaseId = ReleaseIdSchema.make("release-next");
const identity: MaterialProjectionIdentity = {
  locale: "en",
  publicPath:
    "subjects/mathematics/function-composition-inverse-function/function-concept",
};

vi.mock("@/lib/content/published/active", () => ({
  fetchActiveContentIdentity: fetchActiveContentIdentityMock,
  readActiveContentIdentity: readActiveContentIdentityMock,
}));

beforeEach(() => {
  fetchActiveContentIdentityMock.mockReset();
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

  it("rechecks a static route without an Effect runtime", async () => {
    fetchActiveContentIdentityMock.mockResolvedValueOnce({
      manifestHash: `sha256:${"a".repeat(64)}`,
      releaseId: activeReleaseId,
      sequence: 3,
    });

    await expect(
      verifyStaticMaterialReleasePin(activeReleaseId, identity)
    ).resolves.toBe(activeReleaseId);
    expect(fetchActiveContentIdentityMock).toHaveBeenCalledOnce();
  });

  it("preserves an absent static active release", async () => {
    fetchActiveContentIdentityMock.mockResolvedValueOnce(null);

    await expect(
      verifyStaticMaterialReleasePin(null, identity)
    ).resolves.toBeNull();
  });

  it("preserves a static route release mismatch", async () => {
    fetchActiveContentIdentityMock.mockResolvedValueOnce({
      manifestHash: `sha256:${"b".repeat(64)}`,
      releaseId: nextReleaseId,
      sequence: 4,
    });

    await expect(
      verifyStaticMaterialReleasePin(activeReleaseId, identity)
    ).rejects.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: nextReleaseId,
      expectedReleaseId: activeReleaseId,
    });
  });
});
