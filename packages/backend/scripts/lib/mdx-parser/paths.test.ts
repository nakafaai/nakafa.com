import {
  buildExerciseSetSlug,
  getArticleDir,
  getExerciseDir,
  getRelativeExercisePathSegments,
  parseArticlePath,
  parseExercisePath,
  parseSubjectPath,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Runs an invalid path effect without preserving its success type. */
const runInvalidPath = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.runPromiseExit(effect);

describe("MDX content paths", () => {
  it("builds exercise set slugs with and without a year", () => {
    expect(
      buildExerciseSetSlug({
        category: "high-school",
        examType: "snbt",
        material: "mathematics",
        exerciseType: "try-out",
        setName: "set-1",
        year: 2026,
      })
    ).toBe("exercises/high-school/snbt/mathematics/try-out/2026/set-1");

    expect(
      buildExerciseSetSlug({
        category: "high-school",
        examType: "snbt",
        material: "mathematics",
        exerciseType: "quiz",
        setName: "set-1",
      })
    ).toBe("exercises/high-school/snbt/mathematics/quiz/set-1");
  });

  it("parses article, subject, and exercise paths", async () => {
    await expect(
      Effect.runPromise(parseArticlePath("articles/politics/demo/id.mdx"))
    ).resolves.toMatchObject({
      type: "article",
      locale: "id",
      category: "politics",
      articleSlug: "demo",
      slug: "articles/politics/demo",
    });

    await expect(
      Effect.runPromise(
        parseSubjectPath(
          "subject/high-school/10/mathematics/algebra/linear-equations/en.mdx"
        )
      )
    ).resolves.toMatchObject({
      type: "subject",
      locale: "en",
      category: "high-school",
      grade: "10",
      material: "mathematics",
      topic: "algebra",
      section: "linear-equations",
      slug: "subject/high-school/10/mathematics/algebra/linear-equations",
    });

    await expect(
      Effect.runPromise(
        parseExercisePath(
          "exercises/high-school/snbt/mathematics/try-out/2026/set-1/1/_question/id.mdx"
        )
      )
    ).resolves.toMatchObject({
      type: "exercise",
      locale: "id",
      category: "high-school",
      examType: "snbt",
      material: "mathematics",
      exerciseType: "try-out",
      setName: "set-1",
      number: 1,
      isQuestion: true,
      year: 2026,
      slug: "exercises/high-school/snbt/mathematics/try-out/2026/set-1/1",
    });

    await expect(
      Effect.runPromise(
        parseExercisePath(
          "exercises/high-school/snbt/mathematics/quiz/set-1/2/_answer/en.mdx"
        )
      )
    ).resolves.toMatchObject({
      isQuestion: false,
      slug: "exercises/high-school/snbt/mathematics/quiz/set-1/2",
    });
  });

  it("extracts content directories and relative exercise hrefs", async () => {
    await expect(
      Effect.runPromise(
        getExerciseDir(
          "exercises/high-school/snbt/mathematics/quiz/set-1/2/_answer/en.mdx"
        )
      )
    ).resolves.toBe("exercises/high-school/snbt/mathematics/quiz/set-1/2");
    expect(getArticleDir("articles/politics/demo/id.mdx")).toBe(
      "articles/politics/demo"
    );
    await expect(
      Effect.runPromise(
        getRelativeExercisePathSegments(
          "/exercises/high-school/snbt/mathematics",
          "/exercises/high-school/snbt/mathematics/try-out/set-1",
          "file"
        )
      )
    ).resolves.toStrictEqual(["try-out", "set-1"]);
    await expect(
      Effect.runPromise(
        getRelativeExercisePathSegments(
          "exercises/high-school/snbt/mathematics",
          "exercises/high-school/snbt/mathematics",
          "file"
        )
      )
    ).resolves.toStrictEqual([]);
  });

  it.each([
    [
      () => runInvalidPath(parseArticlePath("articles/wrong/demo/id.mdx")),
      "Invalid article category",
    ],
    [
      () => runInvalidPath(parseArticlePath("not-an-article.mdx")),
      "Invalid article path",
    ],
    [
      () =>
        runInvalidPath(
          parseSubjectPath("subject/high-school/10/wrong/topic/section/id.mdx")
        ),
      "Invalid material",
    ],
    [
      () =>
        runInvalidPath(
          parseSubjectPath(
            "subject/high-school/10/mathematics/topic/section/xx.mdx"
          )
        ),
      "Invalid locale",
    ],
    [
      () =>
        runInvalidPath(
          parseSubjectPath("subject/bad/10/mathematics/topic/section/id.mdx")
        ),
      "Invalid subject category",
    ],
    [
      () =>
        runInvalidPath(
          parseSubjectPath(
            "subject/high-school/13/mathematics/topic/section/id.mdx"
          )
        ),
      "Invalid grade",
    ],
    [
      () => runInvalidPath(parseSubjectPath("not-a-subject.mdx")),
      "Invalid subject path",
    ],
    [
      () => runInvalidPath(parseExercisePath("no-root/path.mdx")),
      "Invalid exercise path",
    ],
    [
      () =>
        runInvalidPath(
          parseExercisePath(
            "exercises/high-school/snbt/mathematics/quiz/set-1/2/id.mdx"
          )
        ),
      "Invalid exercise path",
    ],
    [
      () =>
        runInvalidPath(
          parseExercisePath(
            "exercises/high-school/snbt/mathematics/quiz/set-1/not-number/_question/id.mdx"
          )
        ),
      'Invalid exercise number "not-number"',
    ],
    [
      () =>
        runInvalidPath(
          parseExercisePath(
            "exercises/high-school/snbt/mathematics/quiz/set-1/2/_wrong/id.mdx"
          )
        ),
      "Invalid exercise path",
    ],
    [
      () =>
        runInvalidPath(
          parseExercisePath(
            "exercises/high-school/snbt/mathematics/quiz//2/_question/id.mdx"
          )
        ),
      "Invalid exercise path",
    ],
    [
      () =>
        runInvalidPath(
          parseExercisePath(
            "exercises/high-school/snbt/mathematics/try-out/26/set-1/1/_question/id.mdx"
          )
        ),
      "Invalid exercise year",
    ],
    [
      () => runInvalidPath(getExerciseDir("file.mdx")),
      "Cannot extract exercise directory",
    ],
    [
      () =>
        runInvalidPath(
          getRelativeExercisePathSegments(
            "exercises/high-school/snbt/mathematics",
            "exercises/high-school/snbt/physics/quiz",
            "file"
          )
        ),
      "must start with",
    ],
  ])("rejects invalid path input", async (run, message) => {
    const exit = await run();

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(exit.cause.toString()).toContain(message);
    }
  });
});
