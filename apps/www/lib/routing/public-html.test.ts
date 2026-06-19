// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readProjectedHtmlRouteRejection,
  readSourceBackedHtmlRouteRejection,
} from "@/lib/routing/public-html";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeExerciseQuestionPage: vi.fn(),
  getRuntimeContentRoute: vi.fn(),
}));

vi.mock("@/lib/content/runtime/pages", () => ({
  getRuntimeExerciseQuestionPage: runtimeMocks.getRuntimeExerciseQuestionPage,
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRoute: runtimeMocks.getRuntimeContentRoute,
}));

describe("public html route rejection", () => {
  beforeEach(() => {
    runtimeMocks.getRuntimeExerciseQuestionPage.mockReset();
    runtimeMocks.getRuntimeExerciseQuestionPage.mockReturnValue(
      Effect.succeed({ exercise: { number: 1 } })
    );
    runtimeMocks.getRuntimeContentRoute.mockReset();
    runtimeMocks.getRuntimeContentRoute.mockReturnValue(
      Effect.succeed({ kind: "exercise-question", route: "fixture" })
    );
  });

  it("rejects stale public namespaces and invisible route groups", async () => {
    const paths = [
      ["/id/curricula/merdeka", "id"],
      ["/id/assessment/snbt/pengetahuan-kuantitatif", "id"],
      ["/id/subjects/matematika/integral", "id"],
      ["/id/practice/snbt/pengetahuan-kuantitatif", "id"],
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

  it("fails closed when an exact article detail lookup is unavailable", async () => {
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
    ).resolves.toBe("en");
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

  it("rejects projected app routes that cannot render HTML", async () => {
    const paths = [
      "/en/subjects/mathematics/integral/invalid.segment",
      "/en/subjects/chemistry/green-chemistry",
      "/en/curriculum/merdeka/class-11-afdocs-nonexistent-8f3a",
      "/en/curriculum/merdeka/class-10/mathematics-afdocs-nonexistent-8f3a",
      "/en/exams/snbt/general-knowledge/mock-test-2026",
      "/en/exams/snbt/general-knowledge/mock-test-2026-afdocs-nonexistent-8f3a",
      "/en/practice/snbt/general-reasoning/mock-test-2026",
      "/en/practice/snbt/general-reasoning/mock-test-2026-afdocs-nonexistent-8f3a",
      "/en/practice/snbt/general-reasoning/mock-test-2026/set-7-afdocs-nonexistent-8f3a",
    ];

    for (const pathname of paths) {
      await expect(
        Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
      ).resolves.toBe("en");
    }
  });

  it("delegates projected app routes that render HTML", async () => {
    const paths = [
      "/en/subjects/chemistry/green-chemistry/definition",
      "/id/kurikulum/merdeka/kelas-10/biologi",
      "/en/curriculum/merdeka/class-10",
      "/en/exams/snbt/general-knowledge",
      "/en/practice/snbt/general-reasoning",
      "/en/practice/snbt/mathematical-reasoning/mock-test-2026/set-2",
      "/en/practice/snbt/mathematical-reasoning/mock-test-2026/set-2/question-1",
      "/id/latihan/snbt/penalaran-matematika/tryout-2026/set-2/soal-1",
    ];

    for (const pathname of paths) {
      await expect(
        Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
      ).resolves.toBe(null);
    }
  });

  it("rejects virtual practice questions missing from the runtime catalog", async () => {
    runtimeMocks.getRuntimeExerciseQuestionPage.mockReturnValueOnce(
      Effect.succeed(null)
    );

    await expect(
      Effect.runPromise(
        readProjectedHtmlRouteRejection(
          "/en/practice/snbt/mathematical-reasoning/mock-test-2026/set-2/question-999"
        )
      )
    ).resolves.toBe("en");
    expect(runtimeMocks.getRuntimeExerciseQuestionPage).toHaveBeenCalledWith({
      locale: "en",
      slug: "material/practice/assessment/snbt/mathematical-reasoning/try-out-2026/set-2/999",
    });
  });

  it("rejects malformed localized practice question leaves before runtime lookup", async () => {
    await expect(
      Effect.runPromise(
        readProjectedHtmlRouteRejection(
          "/en/practice/snbt/mathematical-reasoning/mock-test-2026/set-2/question-099"
        )
      )
    ).resolves.toBe("en");
    await expect(
      Effect.runPromise(
        readProjectedHtmlRouteRejection(
          "/id/latihan/snbt/penalaran-matematika/tryout-2026/set-2/question-1"
        )
      )
    ).resolves.toBe("id");
    await expect(
      Effect.runPromise(
        readProjectedHtmlRouteRejection(
          "/en/practice/snbt/mathematical-reasoning/mock-test-2027/set-2/question-1"
        )
      )
    ).resolves.toBe("en");
    expect(runtimeMocks.getRuntimeExerciseQuestionPage).not.toHaveBeenCalled();
  });

  it("fails closed when virtual practice question runtime lookup fails", async () => {
    runtimeMocks.getRuntimeExerciseQuestionPage.mockReturnValueOnce(
      Effect.fail(new Error("runtime unavailable"))
    );

    await expect(
      Effect.runPromise(
        readProjectedHtmlRouteRejection(
          "/en/practice/snbt/mathematical-reasoning/mock-test-2026/set-2/question-999"
        )
      )
    ).resolves.toBe("en");
  });
});
