import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import type { TryoutSyncArgs } from "@repo/backend/scripts/sync-content/tryout/batch";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

/** Builds one staged or ready try-out source for route projection tests. */
function createTryoutSource(ready: boolean) {
  return {
    countryCode: "ID",
    countryKey: "indonesia",
    countryRouteSlugs: { en: "indonesia", id: "indonesia" },
    countryTranslations: {
      en: { title: "Indonesia" },
      id: { title: "Indonesia" },
    },
    examKey: "tka",
    examRouteSlugs: { en: "tka", id: "tka" },
    examTranslations: {
      en: { title: "TKA" },
      id: { title: "TKA" },
    },
    scoringStrategy: "raw",
    sourceRevision: "2026-07-10",
    tracks: [
      {
        key: "mathematics",
        kind: "subject",
        order: 1,
        routeSlugs: { en: "mathematics", id: "matematika" },
        sets: [
          {
            key: "set-1",
            order: 1,
            routeSlugs: { en: "set-1", id: "set-1" },
            sections: ready
              ? [
                  {
                    key: "mathematics",
                    order: 1,
                    questionCount: 1,
                    questionSourcePath:
                      "question-bank/tryout/indonesia/tka/mathematics/set-1",
                    routeSlugs: { en: "mathematics", id: "matematika" },
                    timeLimitSeconds: 3600,
                    translations: {
                      en: { title: "Mathematics" },
                      id: { title: "Matematika" },
                    },
                    visibility: "internal-entry",
                  },
                ]
              : [],
            translations: {
              en: { title: "Set 1" },
              id: { title: "Set 1" },
            },
          },
        ],
        translations: {
          en: { title: "Mathematics" },
          id: { title: "Matematika" },
        },
      },
    ],
  };
}

/** Loads the try-out sync boundary with source and Convex IO fixtures. */
async function loadTryoutSync(ready: boolean) {
  const calls: TryoutSyncArgs[] = [];

  vi.doMock("@repo/backend/scripts/sync-content/convex/client", () => ({
    callConvexMutation: (
      _config: ConvexConfig,
      _functionRef: unknown,
      args: TryoutSyncArgs
    ) => {
      calls.push(args);
      return Effect.succeed({
        created:
          args.countries.length +
          args.exams.length +
          args.questionSets.length +
          args.questions.length +
          args.routes.length +
          args.sections.length +
          args.sets.length +
          args.tracks.length,
        unchanged: 0,
        updated: 0,
      });
    },
  }));
  vi.doMock("@repo/backend/scripts/lib/mdx-parser/content", () => ({
    computeHash: () => "content-hash",
    parseDateToEpoch: () => Effect.succeed(0),
    readMdxFile: (file: string) =>
      Effect.succeed({
        body: file.includes("answer.") ? "Answer" : "Question",
        metadata: {
          authors: ["nabilfatih"],
          date: "2026-07-10",
          title: "Question 1",
        },
      }),
    readQuestionChoices: () =>
      Effect.succeed({
        en: [{ label: "Answer", value: true }],
        id: [{ label: "Jawaban", value: true }],
      }),
  }));
  vi.doMock("@repo/contents/_types/tryout/source", () => ({
    TRYOUT_SOURCES: [createTryoutSource(ready)],
  }));

  const tryouts = await import(
    "@repo/backend/scripts/sync-content/content/tryouts"
  );

  return { calls, tryouts };
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("syncTryouts", () => {
  it.each([
    {
      expectedKinds: ["tryout-country", "tryout-exam"],
      ready: false,
    },
    {
      expectedKinds: [
        "tryout-country",
        "tryout-exam",
        "tryout-set",
        "tryout-track",
      ],
      ready: true,
    },
  ])("publishes only ready catalog routes when ready is $ready", async ({
    expectedKinds,
    ready,
  }) => {
    const { calls, tryouts } = await loadTryoutSync(ready);

    await Effect.runPromise(
      tryouts.syncTryouts(config, { locale: "id", quiet: true })
    );

    const routes = calls.flatMap((call) => call.routes);
    expect(routes.map((route) => route.kind).sort()).toEqual(expectedKinds);
  });
});
