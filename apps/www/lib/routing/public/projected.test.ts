// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readProjectedHtmlRouteRejection } from "@/lib/routing/public/projected";

const mockGetRuntimePublicRoute = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimePublicRoute: mockGetRuntimePublicRoute,
}));

describe("projected public html route rejection", () => {
  beforeEach(() => {
    mockGetRuntimePublicRoute.mockReset();
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
  });
});
