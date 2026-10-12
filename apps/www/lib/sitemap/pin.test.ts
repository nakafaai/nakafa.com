// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { pinSitemapRelease } from "@/lib/sitemap/pin";

const activeMocks = vi.hoisted(() => ({
  expireActiveContentIdentity: vi.fn(),
  loadActiveContentIdentity: vi.fn(),
  readActiveContentIdentity: vi.fn(),
}));

vi.mock("@/lib/content/published/active", () => activeMocks);

/** Makes the stored pointer and Convex name the given releases. */
function setReleases(stored: string, convex: string) {
  activeMocks.readActiveContentIdentity.mockReturnValue(
    Effect.succeed({ releaseId: stored })
  );
  activeMocks.loadActiveContentIdentity.mockReturnValue(
    Effect.succeed({ releaseId: convex })
  );
}

beforeEach(() => {
  activeMocks.expireActiveContentIdentity
    .mockReset()
    .mockReturnValue(Effect.void);
  setReleases("release-a", "release-a");
});

describe("sitemap release pin", () => {
  it.effect("pins the release of the stored pointer and proves it", () =>
    Effect.gen(function* () {
      const pin = yield* pinSitemapRelease("base", "en");

      expect(pin.identity).toEqual({
        appLocale: "en",
        publicPath: "sitemap/base.xml",
      });
      expect(yield* pin.verify).toBe("release-a");
      expect(activeMocks.expireActiveContentIdentity).not.toHaveBeenCalled();
    })
  );

  it.effect("fails without an active publication", () =>
    Effect.gen(function* () {
      activeMocks.readActiveContentIdentity.mockReturnValue(
        Effect.succeed(null)
      );

      const failure = yield* pinSitemapRelease("quran_en", "en").pipe(
        Effect.flip
      );

      expect(failure).toMatchObject({
        _tag: "PublishedProjectionError",
        publicPath: "sitemap/quran_en.xml",
      });
    })
  );

  it.effect(
    "fails and drops the pointer once Convex names another release",
    () =>
      Effect.gen(function* () {
        setReleases("release-a", "release-b");
        const pin = yield* pinSitemapRelease("base", "en");

        const failure = yield* pin.verify.pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "PublishedReleaseMismatchError",
          actualReleaseId: "release-b",
          expectedReleaseId: "release-a",
        });
        expect(activeMocks.expireActiveContentIdentity).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "reports a page as missing while the pinned release is active",
    () =>
      Effect.gen(function* () {
        const pin = yield* pinSitemapRelease("material_en_p7", "en");

        const failure = yield* pin.missing.pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "SitemapPageNotFoundError",
          pageId: "material_en_p7",
        });
      })
  );

  it.effect(
    "never reports a page as missing across releases, so a page the landing release added is not cached as missing",
    () =>
      Effect.gen(function* () {
        setReleases("release-a", "release-b");
        const pin = yield* pinSitemapRelease("material_en_p7", "en");

        const failure = yield* pin.missing.pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "PublishedReleaseMismatchError",
          actualReleaseId: "release-b",
          expectedReleaseId: "release-a",
        });
        expect(activeMocks.expireActiveContentIdentity).toHaveBeenCalledOnce();
      })
  );
});
