import { describe, expect, it } from "@effect/vitest";
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

describe("MDX content paths", () => {
  it.effect("builds exercise set slugs with and without a year", () =>
    Effect.sync(() => {
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
    })
  );

  it.effect("parses article, subject, and exercise paths", () =>
    Effect.gen(function* () {
      expect(
        yield* parseArticlePath("articles/politics/demo/id.mdx")
      ).toMatchObject({
        articleSlug: "demo",
        category: "politics",
        locale: "id",
        slug: "articles/politics/demo",
        type: "article",
      });

      expect(
        yield* parseSubjectPath(
          "subject/high-school/10/mathematics/algebra/linear-equations/en.mdx"
        )
      ).toMatchObject({
        category: "high-school",
        grade: "10",
        locale: "en",
        material: "mathematics",
        section: "linear-equations",
        slug: "subject/high-school/10/mathematics/algebra/linear-equations",
        topic: "algebra",
        type: "subject",
      });

      expect(
        yield* parseExercisePath(
          "exercises/high-school/snbt/mathematics/try-out/2026/set-1/1/_question/id.mdx"
        )
      ).toMatchObject({
        category: "high-school",
        examType: "snbt",
        exerciseType: "try-out",
        isQuestion: true,
        locale: "id",
        material: "mathematics",
        number: 1,
        setName: "set-1",
        slug: "exercises/high-school/snbt/mathematics/try-out/2026/set-1/1",
        type: "exercise",
        year: 2026,
      });

      expect(
        yield* parseExercisePath(
          "exercises/high-school/snbt/mathematics/quiz/set-1/2/_answer/en.mdx"
        )
      ).toMatchObject({
        isQuestion: false,
        slug: "exercises/high-school/snbt/mathematics/quiz/set-1/2",
      });
    })
  );

  it.effect("extracts content directories and relative exercise hrefs", () =>
    Effect.gen(function* () {
      expect(
        yield* getExerciseDir(
          "exercises/high-school/snbt/mathematics/quiz/set-1/2/_answer/en.mdx"
        )
      ).toBe("exercises/high-school/snbt/mathematics/quiz/set-1/2");
      expect(getArticleDir("articles/politics/demo/id.mdx")).toBe(
        "articles/politics/demo"
      );
      expect(
        yield* getRelativeExercisePathSegments(
          "/exercises/high-school/snbt/mathematics",
          "/exercises/high-school/snbt/mathematics/try-out/set-1",
          "file"
        )
      ).toStrictEqual(["try-out", "set-1"]);
      expect(
        yield* getRelativeExercisePathSegments(
          "exercises/high-school/snbt/mathematics",
          "exercises/high-school/snbt/mathematics",
          "file"
        )
      ).toStrictEqual([]);
    })
  );

  it.effect.each([
    [
      () => Effect.exit(parseArticlePath("articles/wrong/demo/id.mdx")),
      "Invalid article category",
    ],
    [
      () => Effect.exit(parseArticlePath("not-an-article.mdx")),
      "Invalid article path",
    ],
    [
      () =>
        Effect.exit(
          parseSubjectPath("subject/high-school/10/wrong/topic/section/id.mdx")
        ),
      "Invalid material",
    ],
    [
      () =>
        Effect.exit(
          parseSubjectPath(
            "subject/high-school/10/mathematics/topic/section/xx.mdx"
          )
        ),
      "Invalid locale",
    ],
    [
      () =>
        Effect.exit(
          parseSubjectPath("subject/bad/10/mathematics/topic/section/id.mdx")
        ),
      "Invalid subject category",
    ],
    [
      () =>
        Effect.exit(
          parseSubjectPath(
            "subject/high-school/13/mathematics/topic/section/id.mdx"
          )
        ),
      "Invalid grade",
    ],
    [
      () => Effect.exit(parseSubjectPath("not-a-subject.mdx")),
      "Invalid subject path",
    ],
    [
      () => Effect.exit(parseExercisePath("no-root/path.mdx")),
      "Invalid exercise path",
    ],
    [
      () =>
        Effect.exit(
          parseExercisePath(
            "exercises/high-school/snbt/mathematics/quiz/set-1/2/id.mdx"
          )
        ),
      "Invalid exercise path",
    ],
    [
      () =>
        Effect.exit(
          parseExercisePath(
            "exercises/high-school/snbt/mathematics/quiz/set-1/not-number/_question/id.mdx"
          )
        ),
      'Invalid exercise number "not-number"',
    ],
    [
      () =>
        Effect.exit(
          parseExercisePath(
            "exercises/high-school/snbt/mathematics/quiz/set-1/2/_wrong/id.mdx"
          )
        ),
      "Invalid exercise path",
    ],
    [
      () =>
        Effect.exit(
          parseExercisePath(
            "exercises/high-school/snbt/mathematics/quiz//2/_question/id.mdx"
          )
        ),
      "Invalid exercise path",
    ],
    [
      () =>
        Effect.exit(
          parseExercisePath(
            "exercises/high-school/snbt/mathematics/try-out/26/set-1/1/_question/id.mdx"
          )
        ),
      "Invalid exercise year",
    ],
    [
      () => Effect.exit(getExerciseDir("file.mdx")),
      "Cannot extract exercise directory",
    ],
    [
      () =>
        Effect.exit(
          getRelativeExercisePathSegments(
            "exercises/high-school/snbt/mathematics",
            "exercises/high-school/snbt/physics/quiz",
            "file"
          )
        ),
      "must start with",
    ],
  ] as const)("rejects invalid path input", ([run, message]) =>
    Effect.gen(function* () {
      const exit = yield* run();

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        expect(exit.cause.toString()).toContain(message);
      }
    })
  );
});
