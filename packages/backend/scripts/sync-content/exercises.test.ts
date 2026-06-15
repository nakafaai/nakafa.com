import type { ConvexConfig } from "@repo/backend/scripts/sync-content/types";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};
const questionFile =
  "exercises/high-school/tka/mathematics/try-out/2026/set-1/8/_question/id.mdx";
const answerFile =
  "exercises/high-school/tka/mathematics/try-out/2026/set-1/8/_answer/id.mdx";
const exerciseDir =
  "exercises/high-school/tka/mathematics/try-out/2026/set-1/8";
const validSetSlug = "exercises/high-school/tka/mathematics/try-out/2026/set-1";

/** Loads the exercise sync script with deterministic parser and Convex mocks. */
const loadExercisesScript = async ({
  choices,
  materialSlug = validSetSlug,
  questionFiles = [questionFile],
}: {
  choices: {
    en: Array<{ label: string; value: boolean }>;
    id: Array<{ label: string; value: boolean }>;
  } | null;
  materialSlug?: string;
  questionFiles?: string[];
}) => {
  const logErrors: string[] = [];
  const mutationCalls: Array<{ questions?: unknown[]; sets?: unknown[] }> = [];

  vi.doMock("@repo/backend/scripts/lib/mdx-parser/content", async () => {
    const actual = await vi.importActual<
      typeof import("@repo/backend/scripts/lib/mdx-parser/content")
    >("@repo/backend/scripts/lib/mdx-parser/content");

    return {
      ...actual,
      /** Uses a readable deterministic hash in assertions and payloads. */
      computeHash: (value: string) => `hash:${value.length}`,
      /** Parses all fixture dates to one stable epoch. */
      parseDateToEpoch: () => Effect.succeed(1_734_220_800_000),
      /** Returns fixture MDX metadata for question and answer files. */
      readMdxFile: (filePath: string) =>
        Effect.succeed({
          body: filePath === answerFile ? "Answer body" : "Question body",
          contentHash: "content-hash",
          filePath,
          metadata: {
            authors: [{ name: "Nabil Akbarazzima Fatih" }],
            date: "2024-12-15",
            description: "Question description",
            title: "Question title",
          },
        }),
      /** Returns the test-controlled choice payload. */
      readExerciseChoices: () => Effect.succeed(choices),
    };
  });

  vi.doMock("@repo/contents/_types/material/registry", () => ({
    /** Returns the typed Material set that owns the test question route. */
    listExerciseSets: () => [
      {
        category: "high-school",
        description: "Try-out set",
        exerciseType: "try-out",
        exerciseTypeTitle: "Try Out 2026",
        locale: "id",
        material: "mathematics",
        setName: "set-1",
        slug: materialSlug,
        title: "Set 1",
        type: "tka",
        year: 2026,
      },
    ],
  }));

  vi.doMock("@repo/backend/scripts/lib/mdx-parser/paths", async () => {
    const actual = await vi.importActual<
      typeof import("@repo/backend/scripts/lib/mdx-parser/paths")
    >("@repo/backend/scripts/lib/mdx-parser/paths");

    return {
      ...actual,
      /** Returns the exercise directory for the fixture question file. */
      getExerciseDir: () => Effect.succeed(exerciseDir),
      /** Returns parsed path data for the fixture question file. */
      parseExercisePath: () =>
        Effect.succeed({
          category: "high-school",
          examType: "tka",
          exerciseType: "try-out",
          isQuestion: true,
          locale: "id",
          material: "mathematics",
          number: 8,
          setName: "set-1",
          slug: "exercises/high-school/tka/mathematics/try-out/2026/set-1/8",
          type: "exercise",
          year: 2026,
        }),
    };
  });

  vi.doMock("@repo/backend/scripts/sync-content/convex", () => ({
    /** Records the Convex sync payload and returns matching sync counts. */
    callConvexMutation: (
      _config: ConvexConfig,
      _functionRef: unknown,
      args: { questions?: unknown[]; sets?: unknown[] }
    ) => {
      mutationCalls.push(args);

      return Effect.succeed({
        authorLinksCreated: 0,
        choicesCreated: args.questions?.length ? 4 : 0,
        created: args.questions?.length ?? args.sets?.length ?? 0,
        skipped: 0,
        skippedSetSlugs: [],
        unchanged: 0,
        updated: 0,
      });
    },
  }));

  vi.doMock("@repo/backend/scripts/sync-content/logging", () => ({
    /** Keeps duration output deterministic. */
    formatDuration: () => "0ms",
    /** Suppresses normal sync logs. */
    log: () => undefined,
    /** Suppresses error sync logs. */
    logError: (message: string) => logErrors.push(message),
    /** Suppresses success sync logs. */
    logSuccess: () => undefined,
  }));

  vi.doMock("@repo/backend/scripts/sync-content/runtime", () => ({
    /** Returns question fixture files for the requested glob. */
    globFiles: () => Effect.succeed(questionFiles),
  }));

  return {
    logErrors,
    mutationCalls,
    script: await import("@repo/backend/scripts/sync-content/exercises"),
  };
};

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content exercises", () => {
  it("syncs exercise set counts from valid question payloads", async () => {
    const { logErrors, mutationCalls, script } = await loadExercisesScript({
      choices: {
        en: [
          { label: "A", value: true },
          { label: "B", value: false },
        ],
        id: [
          { label: "A", value: true },
          { label: "B", value: false },
        ],
      },
    });

    const result = await Effect.runPromise(
      script.syncExerciseSets(config, { quiet: false })
    );

    expect(logErrors).toEqual([]);
    expect(result.created).toBe(1);
    expect(mutationCalls).toEqual([
      {
        sets: [
          expect.objectContaining({
            questionCount: 1,
            slug: validSetSlug,
          }),
        ],
      },
    ]);
  });

  it("fails exercise set sync before publishing invalid question counts", async () => {
    const { mutationCalls, script } = await loadExercisesScript({
      choices: { en: [], id: [{ label: "A", value: true }] },
    });

    await expect(
      Effect.runPromise(script.syncExerciseSets(config, { quiet: true }))
    ).rejects.toThrow(
      "Cannot sync exercise sets with invalid exercise questions"
    );

    expect(mutationCalls).toHaveLength(0);
  });

  it("rejects material set routes that graph projection cannot classify", async () => {
    const { mutationCalls, script } = await loadExercisesScript({
      choices: {
        en: [{ label: "A", value: true }],
        id: [{ label: "A", value: true }],
      },
      materialSlug: "exercises/high-school/tka/mathematics/set-1",
      questionFiles: [],
    });

    await expect(
      Effect.runPromise(script.syncExerciseSets(config, { quiet: true }))
    ).rejects.toThrow(
      "Exercise set route cannot be projected into a graph group route"
    );

    expect(mutationCalls).toHaveLength(0);
  });

  it("syncs exercise questions with both locale choice arrays", async () => {
    const { logErrors, mutationCalls, script } = await loadExercisesScript({
      choices: {
        en: [
          { label: "A", value: true },
          { label: "B", value: false },
        ],
        id: [
          { label: "A", value: true },
          { label: "B", value: false },
        ],
      },
    });

    const result = await Effect.runPromise(
      script.syncExerciseQuestions(config, { quiet: false })
    );

    expect(logErrors).toEqual([]);
    expect(result.created).toBe(1);
    expect(mutationCalls).toHaveLength(1);
    expect(mutationCalls[0]).toEqual({
      questions: [
        expect.objectContaining({
          choices: {
            en: [
              { isCorrect: true, label: "A", optionKey: "A", order: 0 },
              { isCorrect: false, label: "B", optionKey: "B", order: 1 },
            ],
            id: [
              { isCorrect: true, label: "A", optionKey: "A", order: 0 },
              { isCorrect: false, label: "B", optionKey: "B", order: 1 },
            ],
          },
          slug: "exercises/high-school/tka/mathematics/try-out/2026/set-1/8",
        }),
      ],
    });
  });

  it("does not send incomplete exercise choices to Convex", async () => {
    const { mutationCalls, script } = await loadExercisesScript({
      choices: { en: [], id: [{ label: "A", value: true }] },
    });

    const result = await Effect.runPromise(
      script.syncExerciseQuestions(config, { quiet: true })
    );

    expect(result.created).toBe(0);
    expect(mutationCalls).toHaveLength(0);
  });
});
