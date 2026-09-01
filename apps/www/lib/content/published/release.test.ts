// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect } from "effect";
import type { PublishedProjectionIdentity } from "@/lib/content/published/errors";
import {
  decodeContentReleasePin,
  verifyContentReleasePin,
} from "@/lib/content/published/release";

const readActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-active");
const nextReleaseId = ReleaseIdSchema.make("release-next");
const identity = {
  appLocale: AppLocaleSchema.make("en"),
  publicPath:
    "subjects/mathematics/function-composition-inverse-function/function-concept",
} satisfies PublishedProjectionIdentity;

vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: readActiveContentIdentityMock,
}));

beforeEach(() => {
  readActiveContentIdentityMock.mockReset();
});

describe("content release pin", () => {
  it.effect.each([
    ["active release", activeReleaseId],
    ["no active release", null],
  ])("decodes %s", ([, actual]) =>
    Effect.gen(function* () {
      expect(yield* decodeContentReleasePin(actual, undefined, identity)).toBe(
        actual
      );
    })
  );

  it.effect(
    "maps malformed release data to the material projection failure",
    () =>
      decodeContentReleasePin("invalid release", undefined, identity).pipe(
        Effect.flip,
        Effect.map((error) =>
          expect(error).toMatchObject({
            _tag: "PublishedProjectionError",
            ...identity,
          })
        )
      )
  );

  it.effect("rejects a changed active release", () =>
    decodeContentReleasePin(nextReleaseId, activeReleaseId, identity).pipe(
      Effect.flip,
      Effect.map((error) =>
        expect(error).toMatchObject({
          _tag: "PublishedReleaseMismatchError",
          actualReleaseId: nextReleaseId,
          expectedReleaseId: activeReleaseId,
        })
      )
    )
  );

  it.effect("rechecks the latest active release identity", () =>
    Effect.gen(function* () {
      readActiveContentIdentityMock.mockReturnValueOnce(
        Effect.succeed({
          manifestHash: `sha256:${"a".repeat(64)}`,
          releaseId: activeReleaseId,
          sequence: 3,
        })
      );

      expect(yield* verifyContentReleasePin(activeReleaseId, identity)).toBe(
        activeReleaseId
      );
      expect(readActiveContentIdentityMock).toHaveBeenCalledOnce();
    })
  );

  it.effect("preserves an absent active release identity", () =>
    Effect.gen(function* () {
      readActiveContentIdentityMock.mockReturnValueOnce(Effect.succeed(null));

      expect(yield* verifyContentReleasePin(null, identity)).toBeNull();
    })
  );
});
