// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutSetRoute } from "@/components/tryout/route/attempt.server";

const mocks = vi.hoisted(() => ({
  readTryoutRouteHead: vi.fn(),
  readTryoutSetPage: vi.fn(),
  readTryoutSetSamples: vi.fn(),
  readTryoutTrackSetList: vi.fn(),
}));

vi.mock("@repo/internationalization/src/translator", () => ({
  readServerTranslator: () =>
    Promise.resolve(
      (
        key: string,
        values?: { readonly exam?: string; readonly set?: string }
      ) => (values === undefined ? key : `${key} ${values.set}, ${values.exam}`)
    ),
}));
vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutSetPage: mocks.readTryoutSetPage,
  readTryoutSetSamples: mocks.readTryoutSetSamples,
}));
vi.mock("@/components/tryout/route/catalog.server", () => ({
  readTryoutTrackSetList: mocks.readTryoutTrackSetList,
}));
vi.mock("@/components/tryout/route/metadata.server", () => ({
  readTryoutRouteHead: mocks.readTryoutRouteHead,
}));

const SET = "try-out/id/snbt/2027/utbk/set-1";
const head = {
  canonicalPath: `/en/${SET}`,
  description: "Set 1",
  image: "og-url",
  indexable: true,
  title: "Set 1",
};
const address = {
  country: "id",
  exam: "snbt",
  group: "2027",
  locale: "en",
  set: "set-1",
  track: "utbk",
} as const;
const catalogSet = {
  entrySection: { sectionKey: "section-1" },
  exam: { title: "SNBT" },
  group: { title: "2027" },
  set: {
    countryKey: "indonesia",
    examKey: "snbt",
    publicPath: SET,
    setKey: "set-1",
    title: "Set 1",
    trackKey: "utbk",
  },
  sections: [{ publicPath: `${SET}/section-1` }],
  track: { title: "UTBK" },
};

const samples = [{ body: { prompt: { type: "doc" } }, versionHash: "v1" }];
/** The track's first window as a visitor reads it: this set and the next. */
const trackSets = [
  { durationSeconds: 5400, publicPath: SET, setKey: "set-1", title: "Set 1" },
  {
    durationSeconds: 5400,
    publicPath: "try-out/id/snbt/2027/utbk/set-2",
    runningAttempt: null,
    setKey: "set-2",
    title: "Set 2",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readTryoutSetPage.mockReturnValue(Effect.succeed(catalogSet));
  mocks.readTryoutSetSamples.mockReturnValue(Effect.succeedSome(samples));
  mocks.readTryoutTrackSetList.mockReturnValue(
    Effect.succeed({ result: { page: trackSets } })
  );
  mocks.readTryoutRouteHead.mockReturnValue(Effect.succeedSome(head));
});

describe("readTryoutSetRoute", () => {
  it.effect(
    "answers the set's catalog view with the set to start, its samples and the other sets of its track",
    () =>
      Effect.gen(function* () {
        expect(yield* readTryoutSetRoute(address)).toMatchObject({
          head: {
            ...head,
            description: "set-metadata-description Set 1, SNBT 2027 UTBK",
            title: "set-search-title Set 1, SNBT 2027 UTBK",
          },
          kind: "catalog",
          page: catalogSet,
          restartTarget: {
            entrySection: { sectionKey: "section-1" },
            setPublicPath: SET,
          },
          route: address,
          samples,
          siblings: [
            {
              durationSeconds: 5400,
              publicPath: "try-out/id/snbt/2027/utbk/set-2",
              setKey: "set-2",
              title: "Set 2",
            },
          ],
        });
        expect(mocks.readTryoutSetPage).toHaveBeenCalledExactlyOnceWith(
          "en",
          SET
        );
        expect(mocks.readTryoutSetSamples).toHaveBeenCalledExactlyOnceWith(
          "en",
          SET
        );
        expect(mocks.readTryoutTrackSetList).toHaveBeenCalledExactlyOnceWith({
          locale: "en",
          search: { direction: "asc", sort: "order", status: "all" },
          track: { countryKey: "indonesia", examKey: "snbt", trackKey: "utbk" },
        });
      })
  );

  it.effect("keeps the description a set was published with", () =>
    Effect.gen(function* () {
      mocks.readTryoutSetPage.mockReturnValueOnce(
        Effect.succeed({
          ...catalogSet,
          set: { ...catalogSet.set, description: "Written for this set." },
        })
      );

      expect(yield* readTryoutSetRoute(address)).toMatchObject({
        head: { description: "Written for this set." },
      });
    })
  );

  it.effect(
    "answers not found when the catalog has no set page, no samples or no head",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSetPage.mockReturnValueOnce(Effect.void);
        expect(yield* readTryoutSetRoute(address)).toEqual({
          kind: "notFound",
        });

        mocks.readTryoutSetSamples.mockReturnValueOnce(Effect.succeedNone);
        expect(yield* readTryoutSetRoute(address)).toEqual({
          kind: "notFound",
        });

        mocks.readTryoutRouteHead.mockReturnValueOnce(Effect.succeedNone);
        expect(yield* readTryoutSetRoute(address)).toEqual({
          kind: "notFound",
        });
      })
  );
});
