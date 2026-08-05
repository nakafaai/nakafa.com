// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishedProjectionIdentity } from "@/lib/content/published/errors";
import {
  decodeContentReleasePin,
  verifyContentReleasePin,
  verifyStaticContentReleasePin,
} from "@/lib/content/published/release";

const fetchActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const readActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-active");
const nextReleaseId = ReleaseIdSchema.make("release-next");
const identity = {
  locale: "en",
  publicPath:
    "subjects/mathematics/function-composition-inverse-function/function-concept",
} satisfies PublishedProjectionIdentity;

vi.mock("@/lib/content/published/active", () => ({
  fetchActiveContentIdentity: fetchActiveContentIdentityMock,
  readActiveContentIdentity: readActiveContentIdentityMock,
}));

beforeEach(() => {
  fetchActiveContentIdentityMock.mockReset();
  readActiveContentIdentityMock.mockReset();
});

describe("content release pin", () => {
  it.each([
    ["active release", activeReleaseId],
    ["no active release", null],
  ])("decodes %s", async (_label, actual) => {
    await expect(
      Effect.runPromise(decodeContentReleasePin(actual, undefined, identity))
    ).resolves.toBe(actual);
  });

  it("maps malformed release data to the material projection failure", async () => {
    await expect(
      Effect.runPromise(
        decodeContentReleasePin("invalid release", undefined, identity).pipe(
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
        decodeContentReleasePin(nextReleaseId, activeReleaseId, identity).pipe(
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
      Effect.runPromise(verifyContentReleasePin(activeReleaseId, identity))
    ).resolves.toBe(activeReleaseId);
    expect(readActiveContentIdentityMock).toHaveBeenCalledOnce();
  });

  it("preserves an absent active release identity", async () => {
    readActiveContentIdentityMock.mockReturnValueOnce(Effect.succeed(null));

    await expect(
      Effect.runPromise(verifyContentReleasePin(null, identity))
    ).resolves.toBeNull();
  });

  it("rechecks a static route without an Effect runtime", async () => {
    fetchActiveContentIdentityMock.mockResolvedValueOnce({
      manifestHash: `sha256:${"a".repeat(64)}`,
      releaseId: activeReleaseId,
      sequence: 3,
    });

    await expect(
      verifyStaticContentReleasePin(activeReleaseId, identity)
    ).resolves.toBe(activeReleaseId);
    expect(fetchActiveContentIdentityMock).toHaveBeenCalledOnce();
  });

  it("preserves an absent static active release", async () => {
    fetchActiveContentIdentityMock.mockResolvedValueOnce(null);

    await expect(
      verifyStaticContentReleasePin(null, identity)
    ).resolves.toBeNull();
  });

  it("preserves a static route release mismatch", async () => {
    fetchActiveContentIdentityMock.mockResolvedValueOnce({
      manifestHash: `sha256:${"b".repeat(64)}`,
      releaseId: nextReleaseId,
      sequence: 4,
    });

    await expect(
      verifyStaticContentReleasePin(activeReleaseId, identity)
    ).rejects.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: nextReleaseId,
      expectedReleaseId: activeReleaseId,
    });
  });
});
