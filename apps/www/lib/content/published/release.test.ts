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

const loadActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const expireActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-active");
const nextReleaseId = ReleaseIdSchema.make("release-next");
const identity = {
  appLocale: AppLocaleSchema.make("en"),
  publicPath:
    "subjects/mathematics/function-composition-inverse-function/function-concept",
} satisfies PublishedProjectionIdentity;

vi.mock("@/lib/content/published/active", () => ({
  expireActiveContentIdentity: expireActiveContentIdentityMock,
  loadActiveContentIdentity: loadActiveContentIdentityMock,
}));

beforeEach(() => {
  loadActiveContentIdentityMock.mockReset();
  expireActiveContentIdentityMock.mockReset().mockReturnValue(Effect.void);
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

  it.effect(
    "drops the stored release pointer when a read names another release",
    () =>
      Effect.gen(function* () {
        yield* decodeContentReleasePin(
          nextReleaseId,
          activeReleaseId,
          identity
        ).pipe(Effect.flip);

        expect(expireActiveContentIdentityMock).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "still reports the mismatch when the pointer cannot be dropped",
    () =>
      Effect.gen(function* () {
        expireActiveContentIdentityMock.mockReturnValueOnce(
          Effect.fail("offline")
        );

        const error = yield* decodeContentReleasePin(
          nextReleaseId,
          activeReleaseId,
          identity
        ).pipe(Effect.flip);

        expect(error).toMatchObject({
          _tag: "PublishedReleaseMismatchError",
          actualReleaseId: nextReleaseId,
          expectedReleaseId: activeReleaseId,
        });
      })
  );

  it.effect(
    "keeps the stored release pointer when the read agrees with the pin",
    () =>
      Effect.gen(function* () {
        yield* decodeContentReleasePin(
          activeReleaseId,
          activeReleaseId,
          identity
        );
        yield* decodeContentReleasePin(
          "invalid release",
          undefined,
          identity
        ).pipe(Effect.flip);

        expect(expireActiveContentIdentityMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "drops the stored release pointer when the recheck finds another release",
    () =>
      Effect.gen(function* () {
        loadActiveContentIdentityMock.mockReturnValueOnce(
          Effect.succeed({
            manifestHash: `sha256:${"a".repeat(64)}`,
            releaseId: nextReleaseId,
            sequence: 4,
          })
        );

        const error = yield* verifyContentReleasePin(
          activeReleaseId,
          identity
        ).pipe(Effect.flip);

        expect(error).toMatchObject({ _tag: "PublishedReleaseMismatchError" });
        expect(expireActiveContentIdentityMock).toHaveBeenCalledOnce();
      })
  );

  it.effect("rechecks the latest active release identity", () =>
    Effect.gen(function* () {
      loadActiveContentIdentityMock.mockReturnValueOnce(
        Effect.succeed({
          manifestHash: `sha256:${"a".repeat(64)}`,
          releaseId: activeReleaseId,
          sequence: 3,
        })
      );

      expect(yield* verifyContentReleasePin(activeReleaseId, identity)).toBe(
        activeReleaseId
      );
      expect(loadActiveContentIdentityMock).toHaveBeenCalledOnce();
    })
  );

  it.effect("preserves an absent active release identity", () =>
    Effect.gen(function* () {
      loadActiveContentIdentityMock.mockReturnValueOnce(Effect.succeed(null));

      expect(yield* verifyContentReleasePin(null, identity)).toBeNull();
    })
  );
});
