import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import type { TryoutSyncArgs } from "@repo/backend/scripts/sync-content/tryout/batch";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

/** Builds one staged or ready try-out source for route projection tests. */
function createTryoutSource(ready: boolean, duplicateTrack = false) {
  const track = {
    key: "mathematics",
    kind: "subject",
    order: 1,
    routeSlugs: { en: "mathematics", id: "matematika" },
    sets: [
      {
        key: "set-1",
        order: 1,
        routeSlugs: { en: "set-1", id: "set-1" },
        sections: [
          {
            key: "mathematics",
            order: 1,
            questionCount: ready ? 1 : 0,
            questionSourcePath:
              "question-bank/tryout/indonesia/tka/mathematics/set-1",
            routeSlugs: { en: "mathematics", id: "matematika" },
            timeLimitSeconds: 3600,
            translations: {
              en: { title: "Mathematics" },
              id: { title: "Matematika" },
            },
            visibility: "visible",
          },
        ],
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
  };

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
    tracks: duplicateTrack
      ? [
          track,
          {
            ...track,
            key: "advanced-mathematics",
            sets: [],
            translations: {
              en: { title: "Advanced Mathematics" },
              id: { title: "Matematika Lanjut" },
            },
          },
        ]
      : [track],
  };
}

/** Loads the try-out sync boundary with source and Convex IO fixtures. */
async function loadTryoutSync(
  ready: boolean,
  duplicateTrack = false,
  sharedCountry = false
) {
  const calls: TryoutSyncArgs[] = [];
  const source = createTryoutSource(ready, duplicateTrack);
  const sources = sharedCountry
    ? [
        source,
        {
          ...source,
          examKey: "snbt",
          examRouteSlugs: { en: "snbt", id: "snbt" },
          examTranslations: {
            en: { title: "SNBT" },
            id: { title: "SNBT" },
          },
          sourceRevision: "2026-07-11",
          tracks: [],
        },
      ]
    : [source];

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
    TRYOUT_SOURCES: sources,
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
      cleanupKinds: ["tryout-section", "tryout-set", "tryout-track"],
      publishedKinds: ["tryout-country", "tryout-exam"],
      ready: false,
    },
    {
      cleanupKinds: [],
      publishedKinds: [
        "tryout-country",
        "tryout-exam",
        "tryout-section",
        "tryout-set",
        "tryout-track",
      ],
      ready: true,
    },
  ])("reconciles catalog routes when ready is $ready", async ({
    cleanupKinds,
    publishedKinds,
    ready,
  }) => {
    const { calls, tryouts } = await loadTryoutSync(ready);

    await Effect.runPromise(
      tryouts.syncTryouts(config, { locale: "id", quiet: true })
    );

    const routes = calls.flatMap((call) => call.routes);
    expect(
      routes
        .filter((route) => route.isReady)
        .map((route) => route.kind)
        .sort()
    ).toEqual(publishedKinds);
    expect(
      routes
        .filter((route) => !route.isReady)
        .map((route) => route.kind)
        .sort()
    ).toEqual(cleanupKinds);
  });

  it("rejects duplicate localized routes before the first mutation", async () => {
    const { calls, tryouts } = await loadTryoutSync(true, true);

    const error = await Effect.runPromise(
      tryouts
        .syncTryouts(config, { locale: "id", quiet: true })
        .pipe(Effect.flip)
    );

    expect(error).toEqual(
      expect.objectContaining({
        _tag: "ScriptFailureError",
        message:
          "Duplicate try-out route: id:try-out/indonesia/tka/matematika.",
      })
    );
    expect(calls).toEqual([]);
  });

  it("projects a shared country once across independent exam sources", async () => {
    const { calls, tryouts } = await loadTryoutSync(true, false, true);

    await Effect.runPromise(
      tryouts.syncTryouts(config, { locale: "id", quiet: true })
    );

    expect(calls.flatMap((call) => call.countries)).toHaveLength(1);
    expect(
      calls
        .flatMap((call) => call.routes)
        .filter((route) => route.kind === "tryout-country")
    ).toHaveLength(1);
  });
});
