// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { BASE_URL } from "@/lib/llms/constants";
import { getTryoutLlmsText } from "@/lib/llms/tryout";

/** The catalog's reads, whose answers each test chooses. */
const catalog = vi.hoisted(() => ({
  country: vi.fn(),
  exam: vi.fn(),
  hub: vi.fn(),
  set: vi.fn(),
  sets: vi.fn(),
  track: vi.fn(),
}));
vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutCountryPage: catalog.country,
  readTryoutExamPage: catalog.exam,
  readTryoutHubPage: catalog.hub,
  readTryoutSetList: catalog.sets,
  readTryoutSetPage: catalog.set,
  readTryoutTrackPage: catalog.track,
}));

const COUNTRY = {
  countryKey: "indonesia",
  publicPath: "try-out/indonesia",
  title: "Indonesia",
};
const EXAM = {
  examKey: "snbt",
  publicPath: "try-out/indonesia/snbt",
  title: "SNBT",
};
const TRACK = {
  publicPath: "try-out/indonesia/snbt/2027",
  title: "Year 2027",
  trackKey: "2027",
};
const SET = {
  publicPath: "try-out/indonesia/snbt/2027/set-1",
  title: "Set 1",
};

/** One window of a track's set list, the last unless it names a next one. */
const windowOf = (page: readonly unknown[], next?: string) =>
  Effect.succeed({
    continueCursor: next ?? "",
    isDone: next === undefined,
    page,
  });

const text = (cleanSlug: string) =>
  getTryoutLlmsText({ cleanSlug, locale: "en" });

describe("try-out Markdown", () => {
  it.effect("owns only the try-out routes, and no section page", () =>
    Effect.gen(function* () {
      expect(yield* text("subjects/physics")).toBeNull();
      expect(
        yield* text("try-out/indonesia/snbt/2027/set-1/general-reasoning")
      ).toBeNull();
    })
  );

  it.effect("lists the countries from the hub", () =>
    Effect.gen(function* () {
      catalog.hub.mockReturnValue(
        Effect.succeed({ countries: [{ ...COUNTRY, examCount: 1 }] })
      );

      const hub = yield* text("try-out");

      expect(hub).toContain("# Try out");
      expect(hub).toContain(`URL: ${BASE_URL}/en/try-out`);
      expect(hub).toContain(`- [Indonesia](${BASE_URL}/en/try-out/indonesia)`);
    })
  );

  it.effect("lists a country's exams with what each says of itself", () =>
    Effect.gen(function* () {
      catalog.country
        .mockReturnValueOnce(
          Effect.succeedSome({
            country: COUNTRY,
            exams: [{ ...EXAM, description: "The entrance test." }],
          })
        )
        .mockReturnValueOnce(Effect.succeedNone);

      expect(yield* text("try-out/indonesia")).toContain(
        `- [SNBT](${BASE_URL}/en/try-out/indonesia/snbt): The entrance test.`
      );
      expect(yield* text("try-out/nowhere")).toBeNull();
    })
  );

  it.effect("lists an exam's tracks", () =>
    Effect.gen(function* () {
      catalog.exam
        .mockReturnValueOnce(
          Effect.succeed({
            country: COUNTRY,
            exam: EXAM,
            tracks: [TRACK],
          })
        )
        .mockReturnValueOnce(Effect.succeed(null));

      expect(yield* text("try-out/indonesia/snbt")).toContain(
        `- [Year 2027](${BASE_URL}/en/try-out/indonesia/snbt/2027)`
      );
      expect(yield* text("try-out/indonesia/nothing")).toBeNull();
    })
  );

  it.effect("lists every set of a track, through every window", () =>
    Effect.gen(function* () {
      catalog.track
        .mockReturnValueOnce(
          Effect.succeed({ country: COUNTRY, exam: EXAM, track: TRACK })
        )
        .mockReturnValueOnce(Effect.succeed(null));
      catalog.sets
        .mockReturnValueOnce(windowOf([SET], "next"))
        .mockReturnValueOnce(
          windowOf([
            {
              ...SET,
              publicPath: "try-out/indonesia/snbt/2027/set-2",
              title: "Set 2",
            },
          ])
        );

      const track = yield* text("try-out/indonesia/snbt/2027");

      expect(track).toContain("# SNBT Year 2027");
      expect(track).toContain("Set 1");
      expect(track).toContain("Set 2");
      expect(catalog.sets).toHaveBeenLastCalledWith(
        expect.objectContaining({
          paginationOpts: expect.objectContaining({ cursor: "next" }),
        })
      );
      expect(yield* text("try-out/indonesia/snbt/2030")).toBeNull();
    })
  );

  it.effect("names a set's exam and counts its sections", () =>
    Effect.gen(function* () {
      catalog.set
        .mockReturnValueOnce(
          Effect.succeed({
            exam: EXAM,
            sections: [
              {
                questionCount: 30,
                timeLimitSeconds: 1800,
                title: "General Reasoning",
              },
            ],
            set: SET,
            track: TRACK,
          })
        )
        .mockReturnValueOnce(Effect.succeed(null));

      const set = yield* text("try-out/indonesia/snbt/2027/set-1");

      expect(set).toContain("# SNBT Year 2027 Set 1");
      expect(set).toContain("- General Reasoning: 30 Questions, 30 min");
      expect(yield* text("try-out/indonesia/snbt/2027/set-9")).toBeNull();
    })
  );

  it.effect("describes a track with no words of its own", () =>
    Effect.gen(function* () {
      catalog.track.mockReturnValueOnce(
        Effect.succeed({
          country: COUNTRY,
          exam: EXAM,
          track: { ...TRACK, description: "Its own words." },
        })
      );
      catalog.sets.mockReturnValueOnce(windowOf([]));
      catalog.set.mockReturnValueOnce(
        Effect.succeed({
          exam: EXAM,
          sections: [],
          set: { ...SET, description: "Its own set." },
          track: TRACK,
        })
      );

      expect(yield* text("try-out/indonesia/snbt/2027")).toContain(
        "Its own words."
      );
      expect(yield* text("try-out/indonesia/snbt/2027/set-1")).toContain(
        "Its own set."
      );
    })
  );
});
