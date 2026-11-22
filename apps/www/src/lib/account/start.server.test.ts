// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Effect, Schema } from "effect";
import { TryoutStart } from "@/lib/account/start";
import { readTryoutStart } from "@/lib/account/start.server";

const mocks = vi.hoisted(() => ({
  preloadConfectQuery:
    vi.fn<
      (
        ref: unknown,
        args: unknown,
        token: unknown
      ) => Effect.Effect<unknown, unknown>
    >(),
  scheduleCurrentServerExceptionCapture:
    vi.fn<(error: unknown, properties: unknown) => Effect.Effect<void>>(),
}));

vi.mock("@/lib/data/preload.server", () => ({
  preloadConfectQuery: mocks.preloadConfectQuery,
}));

vi.mock("@/lib/analytics/exception.server", () => ({
  scheduleCurrentServerExceptionCapture:
    mocks.scheduleCurrentServerExceptionCapture,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.scheduleCurrentServerExceptionCapture.mockReturnValue(Effect.void);
});

/** The try-out hub: every country that holds try-outs. */
const HUB = {
  countries: [
    {
      countryCode: "ID",
      countryKey: "indonesia",
      examCount: 2,
      publicPath: "try-out/indonesia",
      title: "Indonesia",
    },
    {
      countryCode: "DE",
      countryKey: "germany",
      examCount: 1,
      publicPath: "try-out/germany",
      title: "Germany",
    },
  ],
  sourceRevision: null,
};

/** Indonesia's page: its two exams. */
const INDONESIA = {
  country: {
    countryCode: "ID",
    countryKey: "indonesia",
    publicPath: "try-out/indonesia",
    title: "Indonesia",
  },
  exams: [
    {
      entryPath: "try-out/indonesia/snbt/2027",
      examKey: "snbt",
      groupAxis: "year",
      publicPath: "try-out/indonesia/snbt",
      title: "SNBT",
    },
    {
      entryPath: "try-out/indonesia/tka/sma",
      examKey: "tka",
      groupAxis: "level",
      publicPath: "try-out/indonesia/tka",
      title: "TKA",
    },
  ],
  sourceRevision: null,
};

/** The countries the hub offers, as the home shows them. */
const COUNTRIES = {
  countries: [
    { countryCode: "ID", title: "Indonesia" },
    { countryCode: "DE", title: "Germany" },
  ],
  kind: "countries",
};

/** Answers the country page with its value, and the hub with its value or, with none, a refusal. */
function answer(country: unknown, hub?: unknown) {
  mocks.preloadConfectQuery.mockImplementation((ref) => {
    if (ref === tryouts.queries.catalog.getCountryPage) {
      return Effect.succeed(country);
    }
    return hub === undefined
      ? Effect.fail({ _tag: "ReleaseError" })
      : Effect.succeed(hub);
  });
}

describe("readTryoutStart", () => {
  it.effect(
    "offers the exams of the country the learner picked, from its page",
    () =>
      Effect.gen(function* () {
        answer(INDONESIA, HUB);
        const start = yield* readTryoutStart(
          "en",
          {
            country: {
              countryCode: "ID",
              key: "indonesia",
              publicPath: "try-out/indonesia",
              title: "Indonesia",
            },
            preferredTryoutCountryKey: "indonesia",
          },
          "token"
        );
        expect(start).toEqual({
          country: {
            countryCode: "ID",
            publicPath: "try-out/indonesia",
            title: "Indonesia",
          },
          exams: [
            { examKey: "snbt", title: "SNBT" },
            { examKey: "tka", title: "TKA" },
          ],
          kind: "country",
        });
        expect(Schema.is(TryoutStart)(start)).toBe(true);
        expect(mocks.preloadConfectQuery).toHaveBeenCalledWith(
          tryouts.queries.catalog.getCountryPage,
          { appLocale: "en", publicPath: "try-out/indonesia" },
          "token"
        );
      })
  );

  it.effect(
    "offers every country when the learner picked none, or the release no longer holds theirs",
    () =>
      Effect.gen(function* () {
        answer(null, HUB);
        expect(yield* readTryoutStart("en", undefined, "token")).toEqual(
          COUNTRIES
        );
        expect(
          yield* readTryoutStart(
            "en",
            {
              country: {
                countryCode: "XX",
                key: "gone",
                publicPath: "try-out/gone",
                title: "Gone",
              },
              preferredTryoutCountryKey: "gone",
            },
            "token"
          )
        ).toEqual(COUNTRIES);
      })
  );

  it.effect("offers no country when the hub cannot be read", () =>
    Effect.gen(function* () {
      answer(null);
      expect(yield* readTryoutStart("en", undefined, "token")).toEqual({
        countries: [],
        kind: "countries",
      });
    })
  );
});
