import { beforeEach, describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import contents from "@repo/backend/confect/_generated/refs/contents";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import progress from "@repo/backend/confect/_generated/refs/progress";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { EMPTY_TALLY } from "@repo/backend/confect/progress/schema";
import { Array as Arr, Deferred, Effect, Option, Schema } from "effect";
import { readHomeScreen } from "@/lib/account/home";
import { TryoutStart } from "@/lib/account/start";
import { QueryReadFailed } from "@/lib/convex/read";

const mocks = vi.hoisted(() => ({
  httpQuery: vi.fn(),
  httpSetAuth: vi.fn<(token: string) => void>(),
  readBrowserSession:
    vi.fn<
      (
        origin: string
      ) => Effect.Effect<{ accessToken: string; userId: string } | null>
    >(),
  readMadeClient: vi.fn<() => Option.Option<{ query: typeof vi.fn }>>(),
  readQueryOn:
    vi.fn<
      (
        client: unknown,
        ref: unknown,
        args: unknown
      ) => Effect.Effect<unknown, unknown>
    >(),
  readRenderedRouteMessages: vi.fn(),
  reportClientException:
    vi.fn<(error: unknown, properties: unknown) => Effect.Effect<void>>(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = mocks.httpQuery;
    setAuth = mocks.httpSetAuth;
  },
}));

vi.mock("@/lib/convex/client", () => ({
  readMadeClient: mocks.readMadeClient,
}));

vi.mock("@/lib/convex/read", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/convex/read")>();
  return {
    ...actual,
    readQueryOn: mocks.readQueryOn,
  };
});

vi.mock("@/lib/auth/token", () => ({
  readBrowserSession: mocks.readBrowserSession,
}));

vi.mock("@/lib/analytics/client", () => ({
  reportClientException: mocks.reportClientException,
}));

vi.mock("@/lib/i18n/rendered", () => ({
  readRenderedRouteMessages: mocks.readRenderedRouteMessages,
}));

const liveClient = { query: vi.fn() };

const account = {
  appUser: { _id: "users-1", name: "Nabil", username: "nabil" },
};

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

const ORIGIN = "https://nakafa.com";

function answerQueries(answers: ReadonlyArray<readonly [unknown, unknown]>) {
  mocks.readQueryOn.mockImplementation((_client, ref) =>
    Option.match(
      Arr.findFirst(answers, ([query]) => query === ref),
      {
        onNone: () => Effect.die("unexpected query"),
        onSome: ([, value]) => Effect.succeed(value),
      }
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readMadeClient.mockReturnValue(Option.some(liveClient));
  mocks.reportClientException.mockReturnValue(Effect.void);
  mocks.readRenderedRouteMessages.mockResolvedValue({
    Metadata: {
      description: "Learn with Nakafa",
      title: "Nakafa",
    },
  });
});

describe("readHomeScreen", () => {
  it.effect(
    "returns SignedOut on a cold load when the browser holds no session",
    () =>
      Effect.gen(function* () {
        mocks.readMadeClient.mockReturnValue(Option.none());
        mocks.readBrowserSession.mockReturnValue(Effect.succeed(null));
        const outcome = yield* readHomeScreen("en", ORIGIN);
        expect(outcome).toEqual({ _tag: "SignedOut" });
        expect(mocks.readQueryOn).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "authenticates an HTTP client on a cold load when no live client exists yet",
    () =>
      Effect.gen(function* () {
        mocks.readMadeClient.mockReturnValue(Option.none());
        mocks.readBrowserSession.mockReturnValue(
          Effect.succeed({ accessToken: "cold-token", userId: "users-1" })
        );
        answerQueries([
          [
            onboarding.queries.getStatus,
            { isAuthenticated: true, isRequired: false },
          ],
          [auth.queries.getCurrentUser, account],
          [contents.queries.recent.getRecentlyViewed, []],
          [progress.queries.growth, null],
          [progress.queries.week, null],
          [progress.queries.leaders, []],
          [tryouts.queries.history.recent, []],
          [learningPreferences.queries.getCurrentTryout, null],
          [tryouts.queries.catalog.getHubPage, HUB],
        ]);
        const outcome = yield* readHomeScreen("en", ORIGIN);
        expect(mocks.httpSetAuth).toHaveBeenCalledExactlyOnceWith("cold-token");
        expect(outcome._tag).toBe("Ready");
      })
  );

  it.effect("returns SignedOut when Convex says the caller is signed out", () =>
    Effect.gen(function* () {
      answerQueries([
        [
          onboarding.queries.getStatus,
          { isAuthenticated: false, isRequired: false },
        ],
        [auth.queries.getCurrentUser, null],
        [contents.queries.recent.getRecentlyViewed, []],
        [progress.queries.growth, null],
        [progress.queries.week, null],
        [progress.queries.leaders, []],
        [tryouts.queries.history.recent, []],
        [learningPreferences.queries.getCurrentTryout, null],
        [tryouts.queries.catalog.getHubPage, HUB],
      ]);
      const outcome = yield* readHomeScreen("en", ORIGIN);
      expect(outcome).toEqual({ _tag: "SignedOut" });
      expect(mocks.readBrowserSession).not.toHaveBeenCalled();
    })
  );

  it.effect("returns Onboarding when the learner must finish onboarding", () =>
    Effect.gen(function* () {
      answerQueries([
        [
          onboarding.queries.getStatus,
          { isAuthenticated: true, isRequired: true },
        ],
        [auth.queries.getCurrentUser, account],
        [contents.queries.recent.getRecentlyViewed, []],
        [progress.queries.growth, null],
        [progress.queries.week, null],
        [progress.queries.leaders, []],
        [tryouts.queries.history.recent, []],
        [learningPreferences.queries.getCurrentTryout, null],
        [tryouts.queries.catalog.getHubPage, HUB],
      ]);
      const outcome = yield* readHomeScreen("en", ORIGIN);
      expect(outcome).toEqual({ _tag: "Onboarding" });
    })
  );

  it.effect(
    "reads the live client with name, progress, week, recent try-outs and recent lessons",
    () =>
      Effect.gen(function* () {
        const week = { days: [], streak: 2, today: "2026-11-09" };
        const attempt = {
          answered: 4,
          attemptId: "attempt-1",
          correct: 0,
          countryCode: "ID",
          examKey: "snbt",
          expiresAt: 2000,
          locale: "en",
          part: {
            key: "quantitative-knowledge",
            title: "Quantitative knowledge",
          },
          publicPath: "try-out/indonesia/snbt/2027/set-1",
          questions: 160,
          score: null,
          startedAt: 1000,
          status: "in-progress",
          title: "Set 1",
          track: "UTBK",
        };
        answerQueries([
          [
            onboarding.queries.getStatus,
            { isAuthenticated: true, isRequired: false },
          ],
          [auth.queries.getCurrentUser, account],
          [
            contents.queries.recent.getRecentlyViewed,
            [{ content_id: "math-1", materialDomain: "mathematics" }],
          ],
          [progress.queries.growth, { lifetime: 30, tally: EMPTY_TALLY }],
          [progress.queries.week, week],
          [progress.queries.leaders, []],
          [tryouts.queries.history.recent, [attempt]],
          [learningPreferences.queries.getCurrentTryout, null],
          [tryouts.queries.catalog.getHubPage, HUB],
        ]);
        const outcome = yield* readHomeScreen("en", ORIGIN);
        expect(outcome._tag).toBe("Ready");
        if (outcome._tag !== "Ready") {
          return expect.unreachable("expected Ready");
        }
        const { screen } = outcome;
        expect(screen.name).toBe("Nabil");
        expect(screen.username).toBe("nabil");
        expect(screen.recent).toEqual([
          { content_id: "math-1", materialDomain: "mathematics" },
        ]);
        expect(screen.recentLooks).toHaveLength(1);
        expect(screen.growth).toMatchObject({ level: 1, lifetime: 30 });
        expect(screen.week).toEqual(week);
        expect(screen.attempts).toEqual([attempt]);
        expect(screen.start).toBeNull();
        expect(screen.seo).toEqual({
          canonicalPath: "/en",
          description: "Learn with Nakafa",
          indexable: false,
          locale: "en",
          title: "Nakafa",
        });
        expect(mocks.readQueryOn).not.toHaveBeenCalledWith(
          expect.anything(),
          tryouts.queries.catalog.getCountryPage,
          expect.anything()
        );
      })
  );

  it.effect(
    "reads the gate and the page queries concurrently in one batch",
    () =>
      Effect.gen(function* () {
        const pageRead = yield* Deferred.make<void>();
        mocks.readQueryOn.mockImplementation((_client, ref) => {
          if (ref === onboarding.queries.getStatus) {
            return Deferred.await(pageRead).pipe(
              Effect.as({ isAuthenticated: true, isRequired: false })
            );
          }
          return Deferred.succeed(pageRead, undefined).pipe(
            Effect.as(ref === auth.queries.getCurrentUser ? account : [])
          );
        });
        const outcome = yield* readHomeScreen("en", ORIGIN);
        expect(outcome._tag).toBe("Ready");
        if (outcome._tag !== "Ready") {
          return expect.unreachable("expected Ready");
        }
        expect(outcome.screen.name).toBe("Nabil");
      })
  );

  it.effect(
    "offers the exams of the preferred try-out country when the learner has no attempts",
    () =>
      Effect.gen(function* () {
        answerQueries([
          [
            onboarding.queries.getStatus,
            { isAuthenticated: true, isRequired: false },
          ],
          [auth.queries.getCurrentUser, account],
          [contents.queries.recent.getRecentlyViewed, []],
          [progress.queries.growth, null],
          [progress.queries.week, null],
          [progress.queries.leaders, []],
          [tryouts.queries.history.recent, []],
          [
            learningPreferences.queries.getCurrentTryout,
            {
              country: {
                countryCode: "ID",
                key: "indonesia",
                publicPath: "try-out/indonesia",
                title: "Indonesia",
              },
              preferredTryoutCountryKey: "indonesia",
            },
          ],
          [tryouts.queries.catalog.getHubPage, HUB],
          [tryouts.queries.catalog.getCountryPage, INDONESIA],
        ]);
        const outcome = yield* readHomeScreen("en", ORIGIN);
        expect(outcome._tag).toBe("Ready");
        if (outcome._tag !== "Ready") {
          return expect.unreachable("expected Ready");
        }
        expect(outcome.screen.start).toEqual({
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
        expect(Schema.is(TryoutStart)(outcome.screen.start)).toBe(true);
      })
  );

  it.effect(
    "falls back to hub countries when the preferred country is gone or unset",
    () =>
      Effect.gen(function* () {
        answerQueries([
          [
            onboarding.queries.getStatus,
            { isAuthenticated: true, isRequired: false },
          ],
          [auth.queries.getCurrentUser, null],
          [contents.queries.recent.getRecentlyViewed, []],
          [progress.queries.growth, null],
          [progress.queries.week, null],
          [progress.queries.leaders, []],
          [tryouts.queries.history.recent, []],
          [
            learningPreferences.queries.getCurrentTryout,
            {
              country: {
                countryCode: "XX",
                key: "gone",
                publicPath: "try-out/gone",
                title: "Gone",
              },
              preferredTryoutCountryKey: "gone",
            },
          ],
          [tryouts.queries.catalog.getHubPage, HUB],
          [tryouts.queries.catalog.getCountryPage, null],
        ]);
        const outcome = yield* readHomeScreen("en", ORIGIN);
        expect(outcome._tag).toBe("Ready");
        if (outcome._tag !== "Ready") {
          return expect.unreachable("expected Ready");
        }
        expect(outcome.screen.name).toBeUndefined();
        expect(outcome.screen.start).toEqual({
          countries: [
            { countryCode: "ID", title: "Indonesia" },
            { countryCode: "DE", title: "Germany" },
          ],
          kind: "countries",
        });
      })
  );

  it.effect(
    "silences typed refusals and reports QueryReadFailed on optional reads without failing the screen",
    () =>
      Effect.gen(function* () {
        const failed = new QueryReadFailed({ cause: "unreachable" });
        mocks.readQueryOn.mockImplementation((_client, ref) => {
          if (ref === onboarding.queries.getStatus) {
            return Effect.succeed({ isAuthenticated: true, isRequired: false });
          }
          if (ref === contents.queries.recent.getRecentlyViewed) {
            return Effect.fail({ _tag: "ReleaseError" });
          }
          if (
            ref === tryouts.queries.history.recent ||
            ref === tryouts.queries.catalog.getHubPage
          ) {
            return Effect.fail(failed);
          }
          if (ref === progress.queries.leaders) {
            return Effect.fail({ _tag: "AuthFailure" });
          }
          return Effect.succeed(
            ref === auth.queries.getCurrentUser ? account : null
          );
        });
        const outcome = yield* readHomeScreen("en", ORIGIN);
        expect(outcome._tag).toBe("Ready");
        if (outcome._tag !== "Ready") {
          return expect.unreachable("expected Ready");
        }
        expect(outcome.screen.attempts).toStrictEqual([]);
        expect(outcome.screen.leaders).toStrictEqual([]);
        expect(outcome.screen.recent).toStrictEqual([]);
        expect(outcome.screen.recentLooks).toStrictEqual([]);
        expect(outcome.screen.start).toEqual({
          countries: [],
          kind: "countries",
        });
        expect(mocks.reportClientException).toHaveBeenCalledTimes(2);
        expect(mocks.reportClientException).toHaveBeenCalledWith(failed, {
          operation: tryouts.queries.history.recent.convexFunctionName,
          source: "home.readOptional",
        });
      })
  );
});
