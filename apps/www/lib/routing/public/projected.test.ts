// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readProjectedHtmlRouteRejection } from "@/lib/routing/public/projected";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeExerciseQuestionPage: vi.fn(),
}));

vi.mock("@/lib/content/runtime/pages", () => ({
  getRuntimeExerciseQuestionPage: runtimeMocks.getRuntimeExerciseQuestionPage,
}));

describe("projected public html route rejection", () => {
  beforeEach(() => {
    runtimeMocks.getRuntimeExerciseQuestionPage.mockReset();
    runtimeMocks.getRuntimeExerciseQuestionPage.mockReturnValue(
      Effect.succeed({ exercise: { number: 1 } })
    );
  });

  it("rejects projected app routes that cannot render HTML", async () => {
    const paths = [
      "/en/subjects/mathematics/integral/invalid.segment",
      "/en/subjects/chemistry/green-chemistry",
      "/en/curriculum/merdeka/class-11-afdocs-nonexistent-8f3a",
      "/en/curriculum/merdeka/class-10/mathematics-afdocs-nonexistent-8f3a",
      "/en/practice/snbt/general-reasoning/tryout-2026",
      "/en/practice/snbt/general-reasoning/tryout-2026-afdocs-nonexistent-8f3a",
      "/en/practice/snbt/general-reasoning/tryout-2026/set-7-afdocs-nonexistent-8f3a",
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
      "/en/curriculum",
      "/id/kurikulum",
      "/id/kurikulum/merdeka/kelas-10/biologi",
      "/en/curriculum/merdeka/class-10",
      "/en/practice/snbt",
      "/en/practice/snbt/general-reasoning",
      "/en/practice/snbt/mathematical-reasoning/tryout-2026/set-2",
      "/en/practice/snbt/mathematical-reasoning/tryout-2026/set-2/question-1",
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
          "/en/practice/snbt/mathematical-reasoning/tryout-2026/set-2/question-999"
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
          "/en/practice/snbt/mathematical-reasoning/tryout-2026/set-2/question-099"
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
          "/en/practice/snbt/mathematical-reasoning/tryout-2027/set-2/question-1"
        )
      )
    ).resolves.toBe("en");
    await expect(
      Effect.runPromise(
        readProjectedHtmlRouteRejection(
          "/en/practice/snbt/unknown-domain/tryout-2026/set-2/question-1"
        )
      )
    ).resolves.toBe("en");
    await expect(
      Effect.runPromise(
        readProjectedHtmlRouteRejection(
          "/en/practice/unknown-assessment/mathematical-reasoning/tryout-2026/set-2/question-1"
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
          "/en/practice/snbt/mathematical-reasoning/tryout-2026/set-2/question-999"
        )
      )
    ).resolves.toBe("en");
  });
});
