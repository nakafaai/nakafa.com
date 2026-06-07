// @vitest-environment node
import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import type {
  NakafaAgentContentRef,
  NakafaAgentSection,
} from "@repo/contents/_lib/agent/schema/ref";
import type { Locale } from "@repo/utilities/locales";
import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nakafaContent } from "@/app/api/chat/nakafa-content";
import {
  readExercise,
  readExerciseMarkdown,
  verifyExercise,
} from "@/app/api/chat/nakafa-content/exercise";
import {
  getMdxRuntimePage,
  readMdxMarkdown,
} from "@/app/api/chat/nakafa-content/markdown";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeArticlePage: vi.fn(),
  getRuntimeExerciseGroupPage: vi.fn(),
  getRuntimeExerciseQuestionPage: vi.fn(),
  getRuntimeExerciseSetPage: vi.fn(),
  getRuntimeSubjectPage: vi.fn(),
}));

vi.mock("@/lib/content/runtime", () => ({
  getRuntimeArticlePage: runtimeMocks.getRuntimeArticlePage,
  getRuntimeExerciseGroupPage: runtimeMocks.getRuntimeExerciseGroupPage,
  getRuntimeExerciseQuestionPage: runtimeMocks.getRuntimeExerciseQuestionPage,
  getRuntimeExerciseSetPage: runtimeMocks.getRuntimeExerciseSetPage,
  getRuntimeSubjectPage: runtimeMocks.getRuntimeSubjectPage,
}));

vi.mock("@repo/contents/_lib/agent/catalog/source", async () => {
  const { Effect } = await import("effect");

  return {
    getNakafaAgentContentIndex: () => Effect.succeed([]),
  };
});

const validSetPath =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";
const validGroupPath =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026";
const articlePath = "articles/politics/dynastic-politics-asian-values";
const subjectPath =
  "subject/high-school/10/mathematics/exponential-logarithm/introduction";

const exerciseSetPage = {
  exercises: [
    {
      answer: {
        metadata: { title: "Answer 1" },
        raw: " Answer raw 1 ",
      },
      choices: {
        en: [
          { label: "A. Correct", value: true },
          { label: "B. Incorrect", value: false },
        ],
        id: [
          { label: "A. Benar", value: true },
          { label: "B. Salah", value: false },
        ],
      },
      number: 1,
      question: {
        metadata: { title: "Question 1" },
        raw: " Question raw 1 ",
      },
    },
    {
      answer: {
        metadata: { title: "Answer 2" },
        raw: "Answer raw 2",
      },
      choices: {
        en: [{ label: "A. Second", value: true }],
        id: [{ label: "A. Kedua", value: true }],
      },
      number: 2,
      question: {
        metadata: { title: "Question 2" },
        raw: "Question raw 2",
      },
    },
  ],
};

function contentRef(
  route: string,
  section: NakafaAgentSection = "exercises",
  locale: Locale = "id"
) {
  return buildNakafaContentRef(locale, route, section);
}

function looseExerciseRef(route: string) {
  return {
    ...contentRef(validSetPath),
    route,
  } as NakafaAgentContentRef;
}

beforeEach(() => {
  vi.clearAllMocks();

  runtimeMocks.getRuntimeArticlePage.mockImplementation(({ slug }) => {
    if (slug.includes("fail")) {
      return Effect.fail(new Error("runtime failed"));
    }

    if (slug.includes("missing")) {
      return Effect.succeed(null);
    }

    if (slug.includes("no-description")) {
      return Effect.succeed({
        body: "Article body",
        metadata: { title: "Article without description" },
      });
    }

    return Effect.succeed({
      body: "Article body",
      metadata: {
        description: "Article description",
        title: "Article title",
      },
    });
  });

  runtimeMocks.getRuntimeSubjectPage.mockImplementation(({ slug }) => {
    if (slug.includes("missing")) {
      return Effect.succeed(null);
    }

    if (slug.includes("subject-without-name")) {
      return Effect.succeed({
        body: "Subject body",
        metadata: { subject: undefined, title: "Subject without name" },
      });
    }

    return Effect.succeed({
      body: "Subject body",
      metadata: {
        subject: "Mathematics",
        title: "Subject title",
      },
    });
  });

  runtimeMocks.getRuntimeExerciseSetPage.mockImplementation(({ slug }) => {
    if (slug === validSetPath) {
      return Effect.succeed(exerciseSetPage);
    }

    return Effect.succeed(null);
  });

  runtimeMocks.getRuntimeExerciseQuestionPage.mockImplementation(({ slug }) =>
    Effect.succeed(slug === `${validSetPath}/1` ? {} : null)
  );

  runtimeMocks.getRuntimeExerciseGroupPage.mockImplementation(({ year }) =>
    Effect.succeed(year === "2026" ? {} : null)
  );
});

describe("chat Nakafa MDX runtime adapter", () => {
  it("reads article and subject markdown from the Convex runtime model", async () => {
    const article = await Effect.runPromise(
      readMdxMarkdown(contentRef(articlePath, "articles"))
    );
    const subject = await Effect.runPromise(
      readMdxMarkdown(contentRef(subjectPath, "subject"))
    );

    expect(Option.getOrUndefined(article)?.description).toBe(
      "Article description"
    );
    expect(Option.getOrUndefined(article)?.text).toContain("Article body");
    expect(Option.getOrUndefined(subject)?.description).toBe("Mathematics");
    expect(Option.getOrUndefined(subject)?.text).toContain("Subject body");
  });

  it("handles missing pages and metadata description fallbacks", async () => {
    const missing = await Effect.runPromise(
      readMdxMarkdown(contentRef("articles/missing", "articles"))
    );
    const articleFallback = await Effect.runPromise(
      readMdxMarkdown(contentRef("articles/no-description", "articles"))
    );
    const subjectFallback = await Effect.runPromise(
      readMdxMarkdown(
        contentRef("subject/high-school/10/subject-without-name", "subject")
      )
    );
    const exercisePage = await Effect.runPromise(
      getMdxRuntimePage(contentRef(validSetPath))
    );

    expect(Option.isNone(missing)).toBe(true);
    expect(Option.getOrUndefined(articleFallback)?.description).toBe("");
    expect(Option.getOrUndefined(subjectFallback)?.description).toBe("");
    expect(exercisePage).toBeNull();
  });
});

describe("chat Nakafa exercise runtime adapter", () => {
  it("reads all exercises and explicit exercise numbers from runtime rows", async () => {
    const allExercises = await Effect.runPromise(
      readExercise(contentRef(validSetPath))
    );
    const secondExercise = await Effect.runPromise(
      readExercise(contentRef(validSetPath), 2)
    );

    expect(Option.getOrUndefined(allExercises)?.count).toBe(2);
    expect(Option.getOrUndefined(allExercises)?.exercises[0]?.choices).toEqual([
      { correct: true, label: "A. Benar" },
      { correct: false, label: "B. Salah" },
    ]);
    expect(Option.getOrUndefined(secondExercise)?.exercise_number).toBe(2);
    expect(Option.getOrUndefined(secondExercise)?.exercises).toHaveLength(1);
  });

  it("reads numbered question routes and returns none for missing targets", async () => {
    const questionRoute = await Effect.runPromise(
      readExercise(contentRef(`${validSetPath}/1`))
    );
    const missingSet = await Effect.runPromise(
      readExercise(contentRef("exercises/high-school/snbt/missing/set-1"))
    );
    const missingQuestion = await Effect.runPromise(
      readExercise(contentRef(validSetPath), 99)
    );

    expect(Option.getOrUndefined(questionRoute)?.route).toBe(validSetPath);
    expect(Option.getOrUndefined(questionRoute)?.exercise_number).toBe(1);
    expect(Option.isNone(missingSet)).toBe(true);
    expect(Option.isNone(missingQuestion)).toBe(true);
  });

  it("renders exercise markdown with checked and unchecked choices", async () => {
    const markdown = await Effect.runPromise(
      readExerciseMarkdown(contentRef(validSetPath, "exercises", "en"))
    );
    const missing = await Effect.runPromise(
      readExerciseMarkdown(contentRef("exercises/high-school/snbt/missing"))
    );

    expect(Option.getOrUndefined(markdown)?.text).toContain(
      "# SNBT Quantitative Knowledge Try Out 2026 Set 1"
    );
    expect(Option.getOrUndefined(markdown)?.text).toContain("- [x] A. Correct");
    expect(Option.getOrUndefined(markdown)?.text).toContain(
      "- [ ] B. Incorrect"
    );
    expect(Option.isNone(missing)).toBe(true);
  });

  it("verifies question, set, group, and invalid exercise routes", async () => {
    await expect(
      Effect.runPromise(verifyExercise(contentRef(`${validSetPath}/1`)))
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(verifyExercise(contentRef(`${validSetPath}/2`)))
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(verifyExercise(contentRef(validSetPath)))
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(verifyExercise(contentRef(validGroupPath)))
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(
        verifyExercise(
          contentRef(
            "exercises/high-school/snbt/quantitative-knowledge/try-out/2027"
          )
        )
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(verifyExercise(contentRef(`${validSetPath}/foo`)))
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        verifyExercise(
          contentRef(
            "exercises/high-school/snbt/quantitative-knowledge/try-out/not-year"
          )
        )
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        verifyExercise(
          contentRef("exercises/invalid/snbt/quantitative-knowledge/try-out")
        )
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        verifyExercise(
          looseExerciseRef(
            "wrong/high-school/snbt/quantitative-knowledge/try-out"
          )
        )
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(verifyExercise(looseExerciseRef("")))
    ).resolves.toBe(false);
  });
});

describe("chat Nakafa service adapter", () => {
  it("routes reads through Quran, exercise, MDX, and invalid-ref branches", async () => {
    const invalid = await Effect.runPromise(nakafaContent.read(""));
    const quran = await Effect.runPromise(nakafaContent.read("/id/quran/1"));
    const exercise = await Effect.runPromise(
      nakafaContent.read(`/id/${validSetPath}`)
    );
    const article = await Effect.runPromise(
      nakafaContent.read(`/id/${articlePath}`)
    );

    expect(Option.isNone(invalid)).toBe(true);
    expect(Option.isSome(quran)).toBe(true);
    expect(Option.getOrUndefined(exercise)?.text).toContain("Answer raw 1");
    expect(Option.getOrUndefined(article)?.title).toBe("Article title");
  });

  it("routes structured exercise reads and rejects non-exercise refs", async () => {
    const invalid = await Effect.runPromise(nakafaContent.exercise(""));
    const article = await Effect.runPromise(
      nakafaContent.exercise(`/id/${articlePath}`)
    );
    const exercise = await Effect.runPromise(
      nakafaContent.exercise(`/id/${validSetPath}`, 1)
    );

    expect(Option.isNone(invalid)).toBe(true);
    expect(Option.isNone(article)).toBe(true);
    expect(Option.getOrUndefined(exercise)?.exercise_number).toBe(1);
  });

  it("keeps Quran and taxonomy reads on the default static corpus", async () => {
    const quran = await Effect.runPromise(nakafaContent.quran({ surah: 1 }));
    const taxonomy = await Effect.runPromise(nakafaContent.taxonomy("id"));

    expect(Option.isSome(quran)).toBe(true);
    expect(taxonomy.locale).toBe("id");
  });

  it("verifies through Convex runtime reads and returns false on read failures", async () => {
    await expect(Effect.runPromise(nakafaContent.verify(""))).resolves.toBe(
      false
    );
    await expect(
      Effect.runPromise(nakafaContent.verify("/id/quran/1"))
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(nakafaContent.verify(`/id/${validSetPath}`))
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(nakafaContent.verify(`/id/${articlePath}`))
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(nakafaContent.verify("/id/articles/fail"))
    ).resolves.toBe(false);
  });
});
