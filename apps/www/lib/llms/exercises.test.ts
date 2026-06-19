// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCachedLlmsExerciseText } from "@/lib/llms/exercises";

const mockCacheLife = vi.hoisted(() => vi.fn());
const mockCacheTag = vi.hoisted(() => vi.fn());
const mockGetRuntimeExerciseSetPage = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  cacheLife: mockCacheLife,
  cacheTag: mockCacheTag,
}));

vi.mock("@/lib/content/runtime/pages", () => ({
  getRuntimeExerciseSetPage: mockGetRuntimeExerciseSetPage,
}));

const validSetPath =
  "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1";

const exerciseWithLocalizedChoices = {
  answer: {
    raw: "Answer raw",
  },
  choices: {
    en: [
      { label: "A. Correct", value: true },
      { label: "B. Incorrect", value: false },
    ],
    id: [{ label: "A. Benar", value: true }],
  },
  number: 1,
  question: {
    metadata: {
      title: "Question title",
    },
    raw: "Question raw",
  },
};

const exerciseWithoutChoices = {
  answer: {
    raw: "Second answer raw",
  },
  choices: {},
  number: 2,
  question: {
    metadata: {},
    raw: "Second question raw",
  },
};

beforeEach(() => {
  mockCacheLife.mockClear();
  mockCacheTag.mockClear();
  mockGetRuntimeExerciseSetPage.mockReset();

  mockGetRuntimeExerciseSetPage.mockReturnValue(
    Effect.succeed({
      description: "Practice with quantitative reasoning.",
      exercises: [exerciseWithLocalizedChoices, exerciseWithoutChoices],
      title: "Quantitative Knowledge Set 1",
    })
  );
});

describe("llms exercise markdown", () => {
  it("returns null for non-exercise markdown routes", async () => {
    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: "articles/politics/dynastic-politics-asian-values",
        locale: "en",
      })
    ).resolves.toBeNull();

    expect(mockCacheTag).toHaveBeenCalledWith("content-runtime");
    expect(mockCacheLife).toHaveBeenCalledWith("contentRuntime");
  });

  it("returns null when an exercise set has no renderable rows", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(
      Effect.succeed({ exercises: [], title: "Empty set" })
    );

    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: validSetPath,
        locale: "en",
      })
    ).resolves.toBeNull();
  });

  it("returns null when the runtime set page is missing", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(Effect.succeed(null));

    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: validSetPath,
        locale: "en",
      })
    ).resolves.toBeNull();
  });

  it("renders set markdown as a bounded question index", async () => {
    const text = await getCachedLlmsExerciseText({
      cleanSlug: validSetPath,
      locale: "id",
      publicSlug: "latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1",
    });

    expect(text).toContain("Practice with quantitative reasoning.");
    expect(text).toContain("## Questions");
    expect(text).toContain(
      "https://nakafa.com/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-1.md"
    );
    expect(text).toContain(
      "https://nakafa.com/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-2.md"
    );
    expect(text).not.toContain("### Answer & Explanation");
  });

  it("treats a trailing slash as the whole exercise set", async () => {
    const text = await getCachedLlmsExerciseText({
      cleanSlug: `${validSetPath}/`,
      locale: "en",
    });

    expect(text).toContain("## Questions");
    expect(text).toContain(`${validSetPath}/question-1.md`);
  });

  it("renders one exercise with English choices and source title", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(
      Effect.succeed({
        exercises: [
          exerciseWithoutChoices,
          {
            ...exerciseWithLocalizedChoices,
            choices: {
              en: [
                { label: "A. Fallback", value: true },
                { label: "B. Fallback", value: false },
              ],
            },
            number: 3,
            question: {
              metadata: {},
              raw: "Third question raw",
            },
          },
        ],
        title: "Quantitative Knowledge Set 1",
      })
    );

    const text = await getCachedLlmsExerciseText({
      cleanSlug: `${validSetPath}/question-3`,
      locale: "id",
    });

    expect(text).toContain("Quantitative Knowledge Set 1");
    expect(text).toContain("Question 3");
    expect(text).toContain("| Pilihan | Benar |");
    expect(text).toContain("| A. Fallback | Ya |");
    expect(text).toContain("| B. Fallback | Tidak |");
    expect(text).toContain("### Answer & Explanation");
    expect(text).toContain("Answer raw");
    expect(text).not.toContain("## Exercise 2");
  });

  it("renders public exercise markdown with semantic math, answers, and link text", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(
      Effect.succeed({
        exercises: [
          {
            ...exerciseWithLocalizedChoices,
            answer: {
              raw: '<BlockMath math="m = 1" />\n\nThen <InlineMath math="k = 2" /> gives the final value <InlineMath math="19" />.',
            },
            choices: {
              en: [
                {
                  label:
                    'paragraph $$1$$ and <InlineMath math="50\\text{ years}" />',
                  value: false,
                },
              ],
            },
            number: 4,
            question: {
              metadata: {},
              raw: 'Read paragraph <InlineMath math="1" /> with $x + y$.\n\n<BlockMath math="x = 2" />\n\n(Adapted from: https://issuu.com/naeyc/docs/example)',
            },
          },
        ],
        title: "English Language Set 1",
      })
    );

    const text = await getCachedLlmsExerciseText({
      cleanSlug: `${validSetPath}/question-4`,
      locale: "en",
    });

    expect(text).toContain("Read paragraph $$1$$ with $$x + y$$.");
    expect(text).toContain("```math\nx = 2\n```");
    expect(text).toContain(
      "(Adapted from: [issuu.com](https://issuu.com/naeyc/docs/example))"
    );
    expect(text).toContain(
      "| paragraph $$1$$ and $$50\\text{ years}$$<br>Visible text: paragraph and | No |"
    );
    expect(text).toContain("### Answer & Explanation");
    expect(text).toContain("```math\nm = 1\n```");
    expect(text).toContain("Then $$k = 2$$ gives the final value $$19$$.");
    expect(text).not.toContain("InlineMath");
  });

  it("preserves practice-local visual component semantics", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(
      Effect.succeed({
        exercises: [
          {
            ...exerciseWithLocalizedChoices,
            choices: {},
            number: 5,
            question: {
              metadata: {},
              raw: `import { Graph } from "./graph";

<Graph
  title="Parabola Graph"
  description={
    <>
      A parabola intersecting the <InlineMath math="x" />-axis.
    </>
  }
/>

The axis of symmetry is <InlineMath math="x = -3" />.`,
            },
          },
        ],
        title: "Quantitative Knowledge Set 7",
      })
    );

    const text = await getCachedLlmsExerciseText({
      cleanSlug: `${validSetPath}/question-5`,
      locale: "en",
    });

    expect(text).toContain("Component: Graph");
    expect(text).toContain("- title: Parabola Graph");
    expect(text).toContain("A parabola intersecting the $$x$$-axis.");
    expect(text).toContain("The axis of symmetry is $$x = -3$$.");
    expect(text).not.toContain('import { Graph } from "./graph"');
  });

  it("preserves malformed exercise source text after typed projection failure", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(
      Effect.succeed({
        exercises: [
          {
            ...exerciseWithLocalizedChoices,
            choices: {},
            number: 6,
            question: {
              metadata: {},
              raw: "Keep \\(x^2\\) and source https://example.com when {syntax breaks.",
            },
          },
        ],
        title: "Quantitative Knowledge Set 8",
      })
    );

    const text = await getCachedLlmsExerciseText({
      cleanSlug: `${validSetPath}/question-6`,
      locale: "en",
    });

    expect(text).toContain("Keep $$x^2$$ and source");
    expect(text).toContain("[example.com](https://example.com)");
  });

  it("uses the exercise title when rendering one titled exercise", async () => {
    const text = await getCachedLlmsExerciseText({
      cleanSlug: `${validSetPath}/question-1`,
      locale: "en",
    });

    expect(text).toContain(
      "Practice with quantitative reasoning. - Question title"
    );
  });

  it("renders one exercise without choice rows when source choices are absent", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(
      Effect.succeed({
        exercises: [
          {
            ...exerciseWithoutChoices,
            answer: { raw: "   " },
          },
        ],
        title: "Quantitative Knowledge Set 1",
      })
    );

    const text = await getCachedLlmsExerciseText({
      cleanSlug: `${validSetPath}/question-2`,
      locale: "en",
    });

    expect(text).toContain("Second question raw");
    expect(text).toContain("### Choices");
    expect(text).not.toContain("### Answer & Explanation");
    expect(text).not.toContain("- [");
  });

  it("returns null when the requested exercise number is missing", async () => {
    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: `${validSetPath}/question-99`,
        locale: "en",
      })
    ).resolves.toBeNull();
  });

  it("uses the set title when no description exists", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(
      Effect.succeed({
        exercises: [exerciseWithLocalizedChoices],
        title: "Quantitative Knowledge Set 1",
      })
    );

    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: validSetPath,
        locale: "en",
      })
    ).resolves.toContain("Quantitative Knowledge Set 1");
  });
});
