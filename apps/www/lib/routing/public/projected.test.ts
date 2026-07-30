// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readProjectedHtmlRouteRejection } from "@/lib/routing/public/projected";

const mockGetRuntimePublicRoute = vi.hoisted(() => vi.fn());
const mockReadActiveContentRoute = vi.hoisted(() => vi.fn());
const mockReadActiveContentIdentity = vi.hoisted(() => vi.fn());
const mockReadPublishedMaterialClaims = vi.hoisted(() => vi.fn());
const mockReadPublishedProgramPath = vi.hoisted(() => vi.fn());
const mockMatchesPreviewRoute = vi.hoisted(() => vi.fn());
const activeReleaseId = "release-active";

vi.mock("@/lib/content/preview/route", () => ({
  matchesPreviewRoute: mockMatchesPreviewRoute,
}));
vi.mock("@/lib/content/material/ownership", () => ({
  readPublishedMaterialClaims: mockReadPublishedMaterialClaims,
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
vi.mock("@/lib/content/program/path", () => ({
  readPublishedProgramPath: mockReadPublishedProgramPath,
}));

describe("projected public html route rejection", () => {
  beforeEach(() => {
    mockGetRuntimePublicRoute.mockReset();
    mockGetRuntimePublicRoute.mockReturnValue(Effect.succeed(null));
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
    mockReadPublishedMaterialClaims
      .mockReset()
      .mockReturnValue(Effect.succeed([]));
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
        Effect.succeed({
          kind,
          locale: pathname.startsWith("/id/") ? "id" : "en",
          publicPath: pathname.split("/").slice(2).join("/"),
          sitemap: true,
          ...(kind === "subject-lesson"
            ? {
                sourcePath:
                  "material/lesson/chemistry/green-chemistry/definition",
              }
            : {}),
        })
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

  it("hard-rejects a source path claimed by one exact material owner", async () => {
    const publicPath = "subjects/mathematics/functions/old-concept";
    mockGetRuntimePublicRoute.mockReturnValueOnce(
      Effect.succeed({
        kind: "subject-lesson",
        locale: "en",
        publicPath,
        sitemap: true,
        sourcePath: "material/lesson/mathematics/functions/concept",
      })
    );
    mockReadPublishedMaterialClaims.mockReturnValueOnce(
      Effect.succeed([
        {
          contentKey: "material/lesson/mathematics/functions/concept",
          kind: "missing",
          locale: "en",
        },
      ])
    );

    await expect(
      Effect.runPromise(readProjectedHtmlRouteRejection(`/en/${publicPath}`))
    ).resolves.toBe("en");
    expect(mockGetRuntimePublicRoute).toHaveBeenCalledTimes(1);
    expect(mockReadPublishedMaterialClaims).toHaveBeenCalledWith(
      "en",
      [
        {
          contentKey: "material/lesson/mathematics/functions/concept",
          locale: "en",
        },
      ],
      activeReleaseId
    );
  });

  it("keys unmanaged ownership to the absence of an active release", async () => {
    mockReadActiveContentIdentity.mockReturnValueOnce(Effect.succeed(null));
    mockReadActiveContentRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId: null, kind: "unmanaged" })
    );
    mockGetRuntimePublicRoute.mockReturnValueOnce(
      Effect.succeed({
        kind: "subject-lesson",
        locale: "en",
        publicPath: "subjects/chemistry/green-chemistry/definition",
        sitemap: true,
        sourcePath: "material/lesson/chemistry/green-chemistry/definition",
      })
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

  it("uses active curriculum ownership for new routes and tombstones", async () => {
    const pathname = "/en/curriculum/merdeka/class-12/mathematics";
    mockReadPublishedProgramPath
      .mockReturnValueOnce(
        Effect.succeed({ managed: true, route: { sitemap: true } })
      )
      .mockReturnValueOnce(
        Effect.succeed({ managed: true, route: { sitemap: false } })
      )
      .mockReturnValueOnce(Effect.succeed({ managed: true, route: null }));

    await expect(
      Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
    ).resolves.toBe("en");
    await expect(
      Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
    ).resolves.toBe("en");
    expect(mockGetRuntimePublicRoute).not.toHaveBeenCalled();
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
