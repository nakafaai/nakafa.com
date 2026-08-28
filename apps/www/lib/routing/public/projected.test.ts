// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import { readProjectedHtmlRouteRejection } from "@/lib/routing/public/projected";

const mockReadRuntimeContentReference = vi.hoisted(() => vi.fn());
const mockReadActiveContentRoute = vi.hoisted(() => vi.fn());
const mockReadActiveContentIdentity = vi.hoisted(() => vi.fn());
const mockReadPublishedProgramPath = vi.hoisted(() => vi.fn());
const mockMatchesPreviewRoute = vi.hoisted(() => vi.fn());
const activeReleaseId = "release-active";

vi.mock("@/lib/content/preview/route", () => ({
  matchesPreviewRoute: mockMatchesPreviewRoute,
}));
vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: mockReadRuntimeContentReference,
}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveContentRoute: mockReadActiveContentRoute,
}));
vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: mockReadActiveContentIdentity,
}));
vi.mock("@/lib/content/program/path", () => ({
  readPublishedProgramPath: mockReadPublishedProgramPath,
}));

/** Runs one projected route decision with an explicit attempt capability. */
function readRejection(pathname: string, hasAttemptCapability = false) {
  return readProjectedHtmlRouteRejection({ hasAttemptCapability, pathname });
}

describe("projected public html route rejection", () => {
  beforeEach(() => {
    mockReadRuntimeContentReference.mockReset();
    mockReadRuntimeContentReference.mockReturnValue(Effect.succeed(null));
    mockReadActiveContentRoute.mockReset();
    mockReadActiveContentRoute.mockReturnValue(
      Effect.succeed({ activeReleaseId, kind: "unmanaged" })
    );
    mockReadActiveContentIdentity
      .mockReset()
      .mockReturnValue(Effect.succeed({ releaseId: activeReleaseId }));
    mockReadPublishedProgramPath
      .mockReset()
      .mockReturnValue(Effect.succeed({ managed: false, route: null }));
    mockMatchesPreviewRoute.mockReset();
    mockMatchesPreviewRoute.mockReturnValue(Effect.succeed(false));
  });

  it.effect(
    "fails closed when signed curriculum ownership is unavailable",
    () =>
      Effect.gen(function* () {
        const rejection = yield* readRejection(
          "/en/curriculum/merdeka/class-11-afdocs-nonexistent-8f3a"
        );

        expect(rejection).toBe("en");
        expect(mockReadPublishedProgramPath).toHaveBeenCalledWith(
          "en",
          "curriculum/merdeka/class-11-afdocs-nonexistent-8f3a"
        );
      })
  );

  it.effect("accepts concrete renderable routes", () =>
    Effect.gen(function* () {
      const paths = [
        ["/en/subjects/chemistry/green-chemistry/definition", "subject-lesson"],
        ["/id/kurikulum/merdeka/kelas-10/biologi", "curriculum-context"],
      ] as const;

      for (const [pathname, kind] of paths) {
        if (kind === "subject-lesson") {
          mockReadActiveContentRoute.mockReturnValueOnce(
            Effect.succeed({ activeReleaseId, kind: "found" })
          );
        } else {
          mockReadPublishedProgramPath.mockReturnValueOnce(
            Effect.succeed({ managed: true, route: { sitemap: true } })
          );
        }

        const rejection = yield* readRejection(pathname);
        expect(rejection).toBeNull();
      }
    })
  );

  it.effect(
    "uses signed try-out ownership for exact routes and tombstones",
    () =>
      Effect.gen(function* () {
        const pathname = "/en/try-out/indonesia/snbt/2027";
        mockReadRuntimeContentReference
          .mockReturnValueOnce(Effect.succeed({ content_id: "tryout:test" }))
          .mockReturnValueOnce(Effect.succeed(null));

        const owned = yield* readRejection(pathname);
        expect(owned).toBeNull();

        const tombstone = yield* readRejection(pathname);
        expect(tombstone).toBe("en");
        expect(mockReadRuntimeContentReference).toHaveBeenCalledWith(
          expect.anything(),
          {
            input: {
              appLocale: "en",
              kind: "route",
              publicPath: "try-out/indonesia/snbt/2027",
            },
          }
        );
      })
  );

  it.effect("requires signed ownership for public set and section routes", () =>
    Effect.gen(function* () {
      const paths = [
        "/en/try-out/indonesia/snbt/2027/set-1",
        "/en/try-out/indonesia/snbt/2027/set-1/general-reasoning",
      ];
      for (const pathname of paths) {
        mockReadRuntimeContentReference
          .mockReturnValueOnce(Effect.succeed({ content_id: "tryout:test" }))
          .mockReturnValueOnce(Effect.succeed(null));

        const owned = yield* readRejection(pathname);
        expect(owned).toBeNull();

        const tombstone = yield* readRejection(pathname);
        expect(tombstone).toBe("en");
      }
      expect(mockReadRuntimeContentReference).toHaveBeenCalledTimes(4);
    })
  );

  it.effect(
    "delegates retained set and section capabilities to page ownership",
    () =>
      Effect.gen(function* () {
        const paths = [
          "/en/try-out/indonesia/snbt/2027/set-1",
          "/en/try-out/indonesia/snbt/2027/set-1/general-reasoning",
        ];
        for (const pathname of paths) {
          const rejection = yield* readRejection(pathname, true);
          expect(rejection).toBeNull();
        }
        expect(mockReadRuntimeContentReference).not.toHaveBeenCalled();
      })
  );

  it.effect("accepts exact local preview routes before published lookups", () =>
    Effect.gen(function* () {
      const paths = [
        [
          "/en/subjects/mathematics/function-composition-inverse-function/function-concept",
          "subjects/mathematics/function-composition-inverse-function/function-concept",
        ],
        [
          "/de/try-out/indonesien/snbt/2027/aufgabensatz-1/quantitatives-wissen",
          "try-out/indonesien/snbt/2027/aufgabensatz-1/quantitatives-wissen",
        ],
      ] as const;

      for (const [pathname, publicPath] of paths) {
        mockMatchesPreviewRoute.mockReturnValueOnce(Effect.succeed(true));
        const rejection = yield* readRejection(pathname);
        expect(rejection).toBeNull();
        expect(mockMatchesPreviewRoute).toHaveBeenLastCalledWith({
          appLocale: pathname.startsWith("/de/") ? "de" : "en",
          publicPath,
        });
      }

      expect(mockReadActiveContentRoute).not.toHaveBeenCalled();
      expect(mockReadRuntimeContentReference).not.toHaveBeenCalled();
    })
  );

  it.effect("uses active ownership for German material routes", () =>
    Effect.gen(function* () {
      const rejection = yield* readRejection(
        "/de/faecher/mathematik/analytische-geometrie/stellung-zweier-kreise"
      );
      expect(rejection).toBe("de");

      expect(mockReadActiveContentRoute).toHaveBeenCalledWith({
        activeReleaseId,
        appLocale: "de",
        family: "material",
        publicPath:
          "faecher/mathematik/analytische-geometrie/stellung-zweier-kreise",
      });
      expect(mockReadRuntimeContentReference).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "uses active ownership for new routes and permanent tombstones",
    () =>
      Effect.gen(function* () {
        const pathname =
          "/en/subjects/mathematics/new-topic/new-published-lesson";
        mockReadActiveContentRoute
          .mockReturnValueOnce(
            Effect.succeed({
              activeReleaseId,
              kind: "found",
              rendererDomain: "mathematics",
            })
          )
          .mockReturnValueOnce(
            Effect.succeed({ activeReleaseId, kind: "missing" })
          );

        const found = yield* readRejection(pathname);
        expect(found).toBeNull();

        const tombstone = yield* readRejection(pathname);
        expect(tombstone).toBe("en");
        expect(mockReadActiveContentRoute).toHaveBeenCalledWith({
          activeReleaseId,
          appLocale: "en",
          family: "material",
          publicPath: "subjects/mathematics/new-topic/new-published-lesson",
        });
      })
  );

  it.effect("fails closed when signed material ownership is unavailable", () =>
    Effect.gen(function* () {
      mockReadActiveContentIdentity.mockReturnValueOnce(Effect.succeed(null));
      mockReadActiveContentRoute.mockReturnValueOnce(
        Effect.succeed({ activeReleaseId: null, kind: "unmanaged" })
      );

      const rejection = yield* readRejection(
        "/en/subjects/chemistry/green-chemistry/definition"
      );
      expect(rejection).toBe("en");
      expect(mockReadActiveContentRoute).toHaveBeenCalledWith({
        activeReleaseId: null,
        appLocale: "en",
        family: "material",
        publicPath: "subjects/chemistry/green-chemistry/definition",
      });
    })
  );

  it.effect(
    "uses active curriculum ownership for new routes and tombstones",
    () =>
      Effect.gen(function* () {
        const pathname = "/en/curriculum/merdeka/class-12/mathematics";
        mockReadPublishedProgramPath
          .mockReturnValueOnce(
            Effect.succeed({ managed: true, route: { sitemap: true } })
          )
          .mockReturnValueOnce(
            Effect.succeed({ managed: true, route: { sitemap: false } })
          )
          .mockReturnValueOnce(Effect.succeed({ managed: true, route: null }));

        const found = yield* readRejection(pathname);
        expect(found).toBeNull();

        const hidden = yield* readRejection(pathname);
        expect(hidden).toBe("en");

        const tombstone = yield* readRejection(pathname);
        expect(tombstone).toBe("en");
      })
  );

  it.effect(
    "delegates application roots and unrelated routes without a lookup",
    () =>
      Effect.gen(function* () {
        const paths = [
          "/en/curriculum",
          "/id/try-out",
          "/en/search",
          "/fr/subjects/mathematics/algebra/linear-equations",
        ];

        for (const pathname of paths) {
          const rejection = yield* readRejection(pathname);
          expect(rejection).toBeNull();
        }

        expect(mockReadActiveContentRoute).not.toHaveBeenCalled();
        expect(mockReadActiveContentIdentity).not.toHaveBeenCalled();
      })
  );
});
