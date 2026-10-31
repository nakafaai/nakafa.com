// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Option } from "effect";
import { readTryoutSectionRoute } from "@/components/tryout/route/section.server";
import { makeTryoutBody } from "@/test/tryout";

const mocks = vi.hoisted(() => ({
  readCurrentTryoutSection: vi.fn(),
  readCurrentTryoutSet: vi.fn(),
  readPlayerMode: vi.fn(),
  readRequestToken: vi.fn(),
  readServerTranslator: vi.fn(),
  readTryoutRouteHead: vi.fn(),
  readRetainedTryoutSection: vi.fn(),
  readTryoutSectionPage: vi.fn(),
  readTryoutSetAttemptPage: vi.fn(),
  readTryoutSetPage: vi.fn(),
  setResponseHeader: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  setResponseHeader: mocks.setResponseHeader,
}));
vi.mock("@/components/player/mode.server", () => ({
  readPlayerMode: mocks.readPlayerMode,
}));
vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutSectionPage: mocks.readTryoutSectionPage,
  readTryoutSetAttemptPage: mocks.readTryoutSetAttemptPage,
  readTryoutSetPage: mocks.readTryoutSetPage,
}));
vi.mock("@/components/tryout/route/catalog.server", () => ({
  readTryoutRouteHead: mocks.readTryoutRouteHead,
}));
vi.mock("@/components/tryout/route/current", () => ({
  readCurrentTryoutSection: mocks.readCurrentTryoutSection,
  readRetainedTryoutSection: mocks.readRetainedTryoutSection,
  readCurrentTryoutSet: mocks.readCurrentTryoutSet,
}));
vi.mock("@/components/tryout/route/token.server", () => ({
  readRequestToken: mocks.readRequestToken,
}));
vi.mock("@repo/internationalization/src/translator", () => ({
  readServerTranslator: mocks.readServerTranslator,
}));
vi.mock("@/lib/seo/social", () => ({ getOgUrl: () => "og-url" }));

const SET = "try-out/id/snbt/2027/set-1";
const SECTION = `${SET}/section-1`;
const head = Option.some({
  canonicalPath: "/en/try-out/id",
  description: "Catalog set",
  image: "og-url",
  indexable: true,
  title: "Set 1",
});
const setAddress = {
  country: "id",
  exam: "snbt",
  locale: "en",
  set: "set-1",
  track: "2027",
} as const;
const sectionAddress = { ...setAddress, section: "section-1" } as const;
const attemptSearch = { attemptId: "attempt-1" };

const NOT_FOUND = { kind: "notFound" };

type Search = Readonly<Record<string, string | undefined>>;

/** Reads the section URL of the fixture address with one search. */
const readSection = (search: Search = {}) =>
  readTryoutSectionRoute({ ...sectionAddress, search });

const catalogSection = {
  section: { description: "Section", publicPath: SECTION, title: "Section 1" },
  set: { countryKey: "id", examKey: "snbt", setKey: "set-1", trackKey: "2027" },
};

/** The body of one question as the attempt page carries it: its JSON text with its placement and version. */
const { placementId, versionHash, ...question } = makeTryoutBody("question-1");
const content = [{ body: encodeJsonText(question), placementId, versionHash }];
const running = {
  content,
  initialState: { attempt: { status: "in-progress" } },
};
const finished = {
  content,
  initialState: {
    attempt: { status: "completed" },
    runtime: { questions: [] },
  },
};

/** One attempt as the attempt readers return it, retained or current. */
function attemptOf(kind: "current" | "retained", overrides: object = {}) {
  return {
    activeSectionPublicPath: undefined,
    activeSetPublicPath: undefined,
    attemptId: "attempt-1",
    content: [],
    initialState: { answers: [] },
    kind,
    page: {
      section: { description: "Section", title: "Section 1" },
      sections: [{ publicPath: SECTION }],
      set: { description: "Set", title: "Set 1" },
    },
    restartTarget: { setPublicPath: SET },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readRequestToken.mockReturnValue(Effect.succeedSome("token-1"));
  mocks.readPlayerMode.mockReturnValue("list");
  mocks.readServerTranslator.mockImplementation(() =>
    Promise.resolve((key: string) => key)
  );
  mocks.readTryoutRouteHead.mockReturnValue(Effect.succeed(head));
  mocks.readTryoutSectionPage.mockReturnValue(Effect.succeed(catalogSection));
  mocks.readTryoutSetAttemptPage.mockReturnValue(
    Effect.succeed(attemptOf("retained"))
  );
  mocks.readRetainedTryoutSection.mockReturnValue(
    Effect.succeedSome(attemptOf("retained"))
  );
  mocks.readCurrentTryoutSet.mockReturnValue(Effect.succeedNone);
  mocks.readCurrentTryoutSection.mockReturnValue(Effect.succeedNone);
});

describe("readTryoutSectionRoute", () => {
  it.effect("answers not found for an empty attempt in a section URL", () =>
    Effect.gen(function* () {
      expect(yield* readSection({ attemptId: "" })).toEqual(NOT_FOUND);
    })
  );

  it.effect(
    "sends an attempt section URL to sign-in when there is no session",
    () =>
      Effect.gen(function* () {
        mocks.readRequestToken.mockReturnValue(Effect.succeedNone);

        expect(yield* readSection(attemptSearch)).toMatchObject({
          kind: "signIn",
        });
      })
  );

  it.effect(
    "answers not found when the attempt section is not the learner's own",
    () =>
      Effect.gen(function* () {
        mocks.readRetainedTryoutSection.mockReturnValue(Effect.succeedNone);

        expect(yield* readSection(attemptSearch)).toEqual(NOT_FOUND);
      })
  );

  it.effect(
    "passes a running retained section's questions as decoded bodies",
    () =>
      Effect.gen(function* () {
        mocks.readRetainedTryoutSection.mockReturnValue(
          Effect.succeedSome(attemptOf("retained", running))
        );

        expect(yield* readSection(attemptSearch)).toMatchObject({
          content: [makeTryoutBody("question-1")],
          kind: "attempt",
        });
      })
  );

  it.effect(
    "renders the retained section with its set as the return link",
    () =>
      Effect.gen(function* () {
        mocks.readRetainedTryoutSection.mockReturnValue(
          Effect.succeedSome(
            attemptOf("retained", {
              activeSetPublicPath: "try-out/id/snbt/2027/set-2",
            })
          )
        );

        const route = yield* readSection(attemptSearch);

        expect(route).toMatchObject({
          kind: "attempt",
          setPath: "try-out/id/snbt/2027/set-2",
          head: {
            description: "Section",
            title: { absolute: "Section 1" },
          },
        });
      })
  );

  it.effect("passes a finished retained section's bodies for its review", () =>
    Effect.gen(function* () {
      mocks.readRetainedTryoutSection.mockReturnValue(
        Effect.succeedSome(attemptOf("retained", finished))
      );

      expect(yield* readSection(attemptSearch)).toMatchObject({
        content: [makeTryoutBody("question-1")],
        kind: "attempt",
      });
    })
  );

  it.effect(
    "answers not found when the catalog has no section page or no head",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSectionPage.mockReturnValueOnce(Effect.void);
        expect(yield* readSection()).toEqual(NOT_FOUND);

        mocks.readTryoutRouteHead.mockReturnValueOnce(Effect.succeedNone);
        expect(yield* readSection()).toEqual(NOT_FOUND);
      })
  );

  it.effect(
    "shows the catalog section without an attempt when the learner has no session",
    () =>
      Effect.gen(function* () {
        mocks.readRequestToken.mockReturnValue(Effect.succeedNone);

        const route = yield* readSection();

        expect(route).toMatchObject({
          binding: null,
          content: null,
          kind: "catalog",
          setPath: "try-out/id/snbt/2027/set-1",
        });
      })
  );

  it.effect(
    "binds the learner's current section to its start link and its set",
    () =>
      Effect.gen(function* () {
        mocks.readCurrentTryoutSection.mockReturnValue(
          Effect.succeedSome(
            attemptOf("current", {
              activeSectionPublicPath: SECTION,
              activeSetPublicPath: "try-out/id/snbt/2027/set-2",
            })
          )
        );

        const route = yield* readSection();

        expect(route).toMatchObject({
          binding: { startPath: SECTION },
          kind: "catalog",
          setPath: "try-out/id/snbt/2027/set-2",
        });
      })
  );

  it.effect(
    "binds a current section with no active section or set to the public links",
    () =>
      Effect.gen(function* () {
        mocks.readCurrentTryoutSection.mockReturnValue(
          Effect.succeedSome(attemptOf("current"))
        );

        const route = yield* readSection();

        expect(route).toMatchObject({
          binding: { startPath: null },
          content: null,
          setPath: "try-out",
        });
      })
  );

  it.effect(
    "passes a running current section's questions as decoded bodies",
    () =>
      Effect.gen(function* () {
        mocks.readCurrentTryoutSection.mockReturnValue(
          Effect.succeedSome(attemptOf("current", running))
        );

        expect(yield* readSection()).toMatchObject({
          content: [makeTryoutBody("question-1")],
          kind: "catalog",
        });
      })
  );
});
