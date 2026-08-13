// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  return Effect.runPromise(
    readProjectedHtmlRouteRejection({ hasAttemptCapability, pathname })
  );
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

  it("fails closed when signed curriculum ownership is unavailable", async () => {
    await expect(
      readRejection("/en/curriculum/merdeka/class-11-afdocs-nonexistent-8f3a")
    ).resolves.toBe("en");
    expect(mockReadPublishedProgramPath).toHaveBeenCalledWith(
      "en",
      "curriculum/merdeka/class-11-afdocs-nonexistent-8f3a"
    );
  });

  it("accepts concrete renderable routes", async () => {
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

      await expect(readRejection(pathname)).resolves.toBe(null);
    }
  });

  it("uses signed try-out ownership for exact routes and tombstones", async () => {
    const pathname = "/en/try-out/indonesia/snbt/2027";
    mockReadRuntimeContentReference
      .mockReturnValueOnce(Effect.succeed({ content_id: "tryout:test" }))
      .mockReturnValueOnce(Effect.succeed(null));

    await expect(readRejection(pathname)).resolves.toBeNull();
    await expect(readRejection(pathname)).resolves.toBe("en");
    expect(mockReadRuntimeContentReference).toHaveBeenCalledWith(
      expect.anything(),
      {
        input: {
          kind: "route",
          locale: "en",
          publicPath: "try-out/indonesia/snbt/2027",
        },
      }
    );
  });

  it("requires signed ownership for public set and section routes", async () => {
    const paths = [
      "/en/try-out/indonesia/snbt/2027/set-1",
      "/en/try-out/indonesia/snbt/2027/set-1/general-reasoning",
    ];
    for (const pathname of paths) {
      mockReadRuntimeContentReference
        .mockReturnValueOnce(Effect.succeed({ content_id: "tryout:test" }))
        .mockReturnValueOnce(Effect.succeed(null));

      await expect(readRejection(pathname)).resolves.toBeNull();
      await expect(readRejection(pathname)).resolves.toBe("en");
    }
    expect(mockReadRuntimeContentReference).toHaveBeenCalledTimes(4);
  });

  it("delegates retained set and section capabilities to page ownership", async () => {
    const paths = [
      "/en/try-out/indonesia/snbt/2027/set-1",
      "/en/try-out/indonesia/snbt/2027/set-1/general-reasoning",
    ];
    for (const pathname of paths) {
      await expect(readRejection(pathname, true)).resolves.toBeNull();
    }
    expect(mockReadRuntimeContentReference).not.toHaveBeenCalled();
  });

  it("accepts the exact local preview route before the Convex lookup", async () => {
    mockMatchesPreviewRoute.mockReturnValueOnce(Effect.succeed(true));

    await expect(
      readRejection(
        "/en/subjects/mathematics/function-composition-inverse-function/function-concept"
      )
    ).resolves.toBe(null);
    expect(mockMatchesPreviewRoute).toHaveBeenCalledWith({
      locale: "en",
      publicPath:
        "subjects/mathematics/function-composition-inverse-function/function-concept",
    });
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

    await expect(readRejection(pathname)).resolves.toBeNull();
    await expect(readRejection(pathname)).resolves.toBe("en");
    expect(mockReadActiveContentRoute).toHaveBeenCalledWith({
      activeReleaseId,
      family: "material",
      locale: "en",
      publicPath: "subjects/mathematics/new-topic/new-published-lesson",
    });
  });

  it("fails closed when signed material ownership is unavailable", async () => {
    mockReadActiveContentIdentity.mockReturnValueOnce(Effect.succeed(null));
    mockReadActiveContentRoute.mockReturnValueOnce(
      Effect.succeed({ activeReleaseId: null, kind: "unmanaged" })
    );

    await expect(
      readRejection("/en/subjects/chemistry/green-chemistry/definition")
    ).resolves.toBe("en");
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

    await expect(readRejection(pathname)).resolves.toBeNull();
    await expect(readRejection(pathname)).resolves.toBe("en");
    await expect(readRejection(pathname)).resolves.toBe("en");
  });

  it("delegates application roots and unrelated routes without a lookup", async () => {
    const paths = [
      "/en/curriculum",
      "/id/try-out",
      "/en/search",
      "/fr/subjects/mathematics/algebra/linear-equations",
    ];

    for (const pathname of paths) {
      await expect(readRejection(pathname)).resolves.toBe(null);
    }

    expect(mockReadActiveContentRoute).not.toHaveBeenCalled();
    expect(mockReadActiveContentIdentity).not.toHaveBeenCalled();
  });
});
