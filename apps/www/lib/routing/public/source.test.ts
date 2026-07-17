// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSourceBackedHtmlRouteRejection } from "@/lib/routing/public/source";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeContentRoute: vi.fn(),
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRoute: runtimeMocks.getRuntimeContentRoute,
}));

describe("source-backed public html route rejection", () => {
  beforeEach(() => {
    runtimeMocks.getRuntimeContentRoute.mockReset();
    runtimeMocks.getRuntimeContentRoute.mockReturnValue(
      Effect.succeed({ kind: "article", route: "fixture" })
    );
  });

  it("rejects stale public namespaces and invisible route groups", async () => {
    const paths = [
      ["/id/curricula/merdeka", "id"],
      ["/id/subjects/matematika/integral", "id"],
      ["/en/kurikulum/merdeka/kelas-10", "en"],
      ["/en/materi/mathematics/integral", "en"],
      ["/learn", "en"],
    ] as const;

    for (const [pathname, locale] of paths) {
      await expect(
        Effect.runPromise(
          readSourceBackedHtmlRouteRejection({
            method: "GET",
            pathname,
          })
        )
      ).resolves.toBe(locale);
    }
  });

  it("rejects impossible Quran and article HTML paths before app rendering", async () => {
    const paths = [
      "/id/quran/999",
      "/id/quran/abc",
      "/id/quran/01",
      "/id/quran/1/extra",
      "/en/articles/politics/nepotism-in-political-governance/extra",
      "/en/articles/politics-afdocs-nonexistent-8f3a",
    ];

    for (const pathname of paths) {
      await expect(
        Effect.runPromise(
          readSourceBackedHtmlRouteRejection({
            method: "GET",
            pathname,
          })
        )
      ).resolves.toBe(pathname.startsWith("/id/") ? "id" : "en");
    }
  });

  it("uses the runtime route catalog for exact article detail HTML paths", async () => {
    runtimeMocks.getRuntimeContentRoute.mockReturnValueOnce(
      Effect.succeed(null)
    );

    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "HEAD",
          pathname:
            "/en/articles/politics/nepotism-in-political-governance-afdocs-nonexistent-8f3a",
        })
      )
    ).resolves.toBe("en");
    expect(runtimeMocks.getRuntimeContentRoute).toHaveBeenCalledWith({
      locale: "en",
      route:
        "articles/politics/nepotism-in-political-governance-afdocs-nonexistent-8f3a",
    });

    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "HEAD",
          pathname: "/en/articles/politics/nepotism-in-political-governance",
        })
      )
    ).resolves.toBe(null);
  });

  it("propagates exact article lookup failures", async () => {
    runtimeMocks.getRuntimeContentRoute.mockReturnValueOnce(
      Effect.fail(new Error("runtime unavailable"))
    );

    await expect(
      Effect.runPromise(
        readSourceBackedHtmlRouteRejection({
          method: "HEAD",
          pathname: "/en/articles/politics/nepotism-in-political-governance",
        })
      )
    ).rejects.toThrow("runtime unavailable");
  });

  it("delegates source-backed index, category, and non-read paths", async () => {
    const requests = [
      { method: "GET", pathname: "/id/quran" },
      { method: "GET", pathname: "/en/articles" },
      { method: "GET", pathname: "/en/articles/politics" },
      { method: "GET", pathname: "/id/quran/1.md" },
      {
        method: "GET",
        pathname: "/en/articles/politics/nepotism-in-political-governance.md",
      },
      { method: "POST", pathname: "/en/articles/politics/not-a-read-check" },
    ];

    for (const request of requests) {
      await expect(
        Effect.runPromise(readSourceBackedHtmlRouteRejection(request))
      ).resolves.toBe(null);
    }
    expect(runtimeMocks.getRuntimeContentRoute).not.toHaveBeenCalled();
  });
});
