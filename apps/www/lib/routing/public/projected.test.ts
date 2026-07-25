// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readProjectedHtmlRouteRejection } from "@/lib/routing/public/projected";

const mockGetRuntimePublicRoute = vi.hoisted(() => vi.fn());
const mockReadActiveContentRoute = vi.hoisted(() => vi.fn());
const mockReadActiveContentIdentity = vi.hoisted(() => vi.fn());
const mockMatchesPreviewRoute = vi.hoisted(() => vi.fn());
const activeReleaseId = "release-active";

vi.mock("@/lib/content/preview/route", () => ({
  matchesPreviewRoute: mockMatchesPreviewRoute,
}));
vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimePublicRoute: mockGetRuntimePublicRoute,
}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveContentRoute: mockReadActiveContentRoute,
}));
vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: mockReadActiveContentIdentity,
}));

describe("projected public html route rejection", () => {
  beforeEach(() => {
    mockGetRuntimePublicRoute.mockReset();
    mockReadActiveContentRoute.mockReset();
    mockReadActiveContentRoute.mockReturnValue(
      Effect.succeed({ activeReleaseId, kind: "unmanaged" })
    );
    mockReadActiveContentIdentity
      .mockReset()
      .mockReturnValue(Effect.succeed({ releaseId: activeReleaseId }));
    mockMatchesPreviewRoute.mockReset();
    mockMatchesPreviewRoute.mockReturnValue(Effect.succeed(false));
  });

  it("rejects missing projected routes through one indexed lookup", async () => {
    mockGetRuntimePublicRoute.mockReturnValue(Effect.succeed(null));

    await expect(
      Effect.runPromise(
        readProjectedHtmlRouteRejection(
          "/en/curriculum/merdeka/class-11-afdocs-nonexistent-8f3a"
        )
      )
    ).resolves.toBe("en");
    expect(mockGetRuntimePublicRoute).toHaveBeenCalledWith({
      locale: "en",
      publicPath: "curriculum/merdeka/class-11-afdocs-nonexistent-8f3a",
    });
  });

  it("accepts concrete renderable routes", async () => {
    const paths = [
      ["/en/subjects/chemistry/green-chemistry/definition", "subject-lesson"],
      ["/id/kurikulum/merdeka/kelas-10/biologi", "curriculum-context"],
      [
        "/en/try-out/indonesia/snbt/2027/set-1/general-reasoning",
        "tryout-section",
      ],
    ] as const;

    for (const [pathname, kind] of paths) {
      mockGetRuntimePublicRoute.mockReturnValueOnce(
        Effect.succeed({ kind, sitemap: true })
      );

      await expect(
        Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
      ).resolves.toBe(null);
    }
  });

  it("accepts the exact local preview route before the Convex lookup", async () => {
    mockMatchesPreviewRoute.mockReturnValueOnce(Effect.succeed(true));

    await expect(
      Effect.runPromise(
        readProjectedHtmlRouteRejection(
          "/en/subjects/mathematics/function-composition-inverse-function/function-concept"
        )
      )
    ).resolves.toBe(null);
    expect(mockMatchesPreviewRoute).toHaveBeenCalledWith({
      locale: "en",
      publicPath:
        "subjects/mathematics/function-composition-inverse-function/function-concept",
    });
    expect(mockGetRuntimePublicRoute).not.toHaveBeenCalled();
    expect(mockReadActiveContentRoute).not.toHaveBeenCalled();
  });

  it("uses active ownership for new routes and permanent tombstones", async () => {
    const pathname = "/en/subjects/mathematics/new-topic/new-published-lesson";
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

    await expect(
      Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
    ).resolves.toBe("en");
    expect(mockReadActiveContentRoute).toHaveBeenCalledWith({
      activeReleaseId,
      family: "material",
      locale: "en",
      publicPath: "subjects/mathematics/new-topic/new-published-lesson",
    });
    expect(mockGetRuntimePublicRoute).not.toHaveBeenCalled();
  });

  it("keys unmanaged ownership to the absence of an active release", async () => {
    mockReadActiveContentIdentity.mockReturnValueOnce(Effect.succeed(null));
    mockReadActiveContentRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId: null, kind: "unmanaged" })
    );
    mockGetRuntimePublicRoute.mockReturnValueOnce(
      Effect.succeed({ kind: "subject-lesson", sitemap: true })
    );

    await expect(
      Effect.runPromise(
        readProjectedHtmlRouteRejection(
          "/en/subjects/chemistry/green-chemistry/definition"
        )
      )
    ).resolves.toBeNull();
    expect(mockReadActiveContentRoute).toHaveBeenCalledWith({
      activeReleaseId: null,
      family: "material",
      locale: "en",
      publicPath: "subjects/chemistry/green-chemistry/definition",
    });
  });

  it("rejects route rows that do not own the requested HTML surface", async () => {
    const paths = [
      [
        "/en/subjects/chemistry/green-chemistry",
        { kind: "subject-topic", sitemap: false },
      ],
      [
        "/en/curriculum/merdeka/class-10/mathematics",
        { kind: "curriculum-context", sitemap: false },
      ],
      [
        "/en/curriculum/merdeka/class-10/science",
        { kind: "subject-lesson", sitemap: true },
      ],
      [
        "/en/try-out/indonesia/snbt/2027/set-1/not-a-section",
        { kind: "subject-lesson", sitemap: true },
      ],
    ] as const;

    for (const [pathname, route] of paths) {
      mockGetRuntimePublicRoute.mockReturnValueOnce(Effect.succeed(route));

      await expect(
        Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
      ).resolves.toBe("en");
    }
  });

  it("delegates application roots and unrelated routes without a lookup", async () => {
    const paths = [
      "/en/curriculum",
      "/id/try-out",
      "/en/search",
      "/fr/subjects/mathematics/algebra/linear-equations",
    ];

    for (const pathname of paths) {
      await expect(
        Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
      ).resolves.toBe(null);
    }

    expect(mockGetRuntimePublicRoute).not.toHaveBeenCalled();
    expect(mockReadActiveContentRoute).not.toHaveBeenCalled();
    expect(mockReadActiveContentIdentity).not.toHaveBeenCalled();
  });
});
