// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Schema } from "effect";
import { readSubjectMap, SubjectMapJson } from "@/lib/routing/public/subject";

const sitemap = vi.hoisted(() => ({
  buckets: vi.fn(),
  page: vi.fn(),
}));

vi.mock("@/lib/content/material/sitemap", () => ({
  readPublishedMaterialBuckets: sitemap.buckets,
  readPublishedMaterialSitemap: sitemap.page,
}));

/** One page of the material sitemap with the given routes. */
function page(routes: readonly (readonly [string, string])[]) {
  return Effect.succeed({
    routes: Arr.map(routes, ([contentKey, publicPath]) => ({
      contentKey,
      lastModified: "2026-10-30",
      publicPath,
    })),
  });
}

beforeEach(() => {
  sitemap.buckets.mockReset();
  sitemap.page.mockReset();
});

describe("readSubjectMap", () => {
  it.effect("maps every lesson of a locale's release to its public path", () =>
    Effect.gen(function* () {
      sitemap.buckets.mockReturnValue(
        Effect.succeed({ activeReleaseId: "release", buckets: ["a", "b"] })
      );
      sitemap.page.mockReturnValue(
        page([
          [
            "material/lesson/mathematics/circle/sector",
            "materi/matematika/lingkaran/juring",
          ],
          [
            "material/lesson/physics/motion/speed",
            "materi/fisika/gerak/kelajuan",
          ],
        ])
      );

      const artifact = yield* readSubjectMap("id");

      expect(artifact.path).toBe("_moved/subject/id.json");
      expect(yield* Schema.decodeEffect(SubjectMapJson)(artifact.text)).toEqual(
        {
          "material/lesson/mathematics/circle/sector":
            "materi/matematika/lingkaran/juring",
          "material/lesson/physics/motion/speed":
            "materi/fisika/gerak/kelajuan",
        }
      );
      expect(sitemap.page).toHaveBeenCalledWith("id", ["a", "b"]);
    })
  );

  it.effect("fails when a sitemap page of the release is gone", () =>
    Effect.gen(function* () {
      sitemap.buckets.mockReturnValue(
        Effect.succeed({ activeReleaseId: "release", buckets: ["a"] })
      );
      sitemap.page.mockReturnValue(Effect.succeed(null));

      const error = yield* Effect.flip(readSubjectMap("en"));

      expect(error).toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: "en",
        publicPath: "/_moved/subject/en.json",
      });
    })
  );
});
