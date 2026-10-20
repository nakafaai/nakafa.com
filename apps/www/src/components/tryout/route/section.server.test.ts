// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { readTryoutSectionRoute } from "@/components/tryout/route/section.server";

const mocks = vi.hoisted(() => ({
  readCurrentTryoutSection: vi.fn(),
  readCurrentTryoutSet: vi.fn(),
  readPlayerMode: vi.fn(),
  readRequestToken: vi.fn(),
  readServerTranslator: vi.fn(),
  readTryoutQuestionPreview: vi.fn(),
  readTryoutRouteHead: vi.fn(),
  readTryoutSectionAttemptPage: vi.fn(),
  readTryoutSectionPage: vi.fn(),
  readTryoutSetAttemptPage: vi.fn(),
  readTryoutSetPage: vi.fn(),
  renderTryoutPreview: vi.fn(),
  renderTryoutReview: vi.fn(),
  setResponseHeader: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  setResponseHeader: mocks.setResponseHeader,
}));
vi.mock("@/components/player/mode.server", () => ({
  readPlayerMode: mocks.readPlayerMode,
}));
vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutSectionAttemptPage: mocks.readTryoutSectionAttemptPage,
  readTryoutSectionPage: mocks.readTryoutSectionPage,
  readTryoutSetAttemptPage: mocks.readTryoutSetAttemptPage,
  readTryoutSetPage: mocks.readTryoutSetPage,
}));
vi.mock("@/components/tryout/preview/read", () => ({
  readTryoutQuestionPreview: mocks.readTryoutQuestionPreview,
}));
vi.mock("@/components/tryout/route/catalog.server", () => ({
  readTryoutRouteHead: mocks.readTryoutRouteHead,
}));
vi.mock("@/components/tryout/route/current", () => ({
  readCurrentTryoutSection: mocks.readCurrentTryoutSection,
  readCurrentTryoutSet: mocks.readCurrentTryoutSet,
}));
vi.mock("@/components/tryout/route/rendered.server", () => ({
  renderTryoutPreview: mocks.renderTryoutPreview,
  renderTryoutReview: mocks.renderTryoutReview,
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

const signedContent = { answers: [], kind: "signed" };
const runtime = { questions: [] };
const runningSigned = {
  content: signedContent,
  initialState: { attempt: { status: "in-progress" } },
};
const finishedSigned = {
  content: signedContent,
  initialState: { attempt: { status: "completed" }, runtime },
};
const preview = { target: { section: { title: "Question 1" } } };

/** One attempt as the attempt readers return it, retained or current. */
function attemptOf(kind: "current" | "retained", overrides: object = {}) {
  return {
    activeSectionPublicPath: undefined,
    activeSetPublicPath: undefined,
    attemptId: "attempt-1",
    content: { kind: "none" },
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
  mocks.readRequestToken.mockReturnValue(Effect.succeed("token-1"));
  mocks.readPlayerMode.mockReturnValue("list");
  mocks.readServerTranslator.mockImplementation(() =>
    Promise.resolve((key: string) => key)
  );
  mocks.readTryoutQuestionPreview.mockResolvedValue(Option.none());
  mocks.renderTryoutPreview.mockResolvedValue("preview-tree");
  mocks.renderTryoutReview.mockResolvedValue("review-tree");
  mocks.readTryoutRouteHead.mockReturnValue(Effect.succeed(head));
  mocks.readTryoutSectionPage.mockReturnValue(Effect.succeed(catalogSection));
  mocks.readTryoutSetAttemptPage.mockReturnValue(
    Effect.succeed(attemptOf("retained"))
  );
  mocks.readTryoutSectionAttemptPage.mockReturnValue(
    Effect.succeed(attemptOf("retained"))
  );
  mocks.readCurrentTryoutSet.mockReturnValue(Effect.void);
  mocks.readCurrentTryoutSection.mockReturnValue(Effect.void);
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
        mocks.readRequestToken.mockReturnValue(Effect.void);

        expect(yield* readSection(attemptSearch)).toMatchObject({
          kind: "signIn",
        });
      })
  );

  it.effect(
    "answers not found when the attempt section is not the learner's own",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSectionAttemptPage.mockReturnValue(
          Effect.succeed(attemptOf("current"))
        );

        expect(yield* readSection(attemptSearch)).toEqual(NOT_FOUND);
      })
  );

  it.effect("holds a running retained section with signed content", () =>
    Effect.gen(function* () {
      mocks.readTryoutSectionAttemptPage.mockReturnValue(
        Effect.succeed(attemptOf("retained", runningSigned))
      );

      const error = yield* Effect.flip(readSection(attemptSearch));

      expect(error).toMatchObject({ _tag: "TryoutAttemptContentPending" });
    })
  );

  it.effect(
    "renders the retained section with its set as the return link",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSectionAttemptPage.mockReturnValue(
          Effect.succeed(
            attemptOf("retained", {
              activeSetPublicPath: "try-out/id/snbt/2027/set-2",
            })
          )
        );

        const route = yield* readSection(attemptSearch);

        expect(route).toMatchObject({
          kind: "attempt",
          setHref: "/try-out/id/snbt/2027/set-2",
          head: {
            description: "Section",
            title: { absolute: "Section 1" },
          },
        });
      })
  );

  it.effect("renders the review of a finished retained section", () =>
    Effect.gen(function* () {
      mocks.readTryoutSectionAttemptPage.mockReturnValue(
        Effect.succeed(attemptOf("retained", finishedSigned))
      );

      const route = yield* readSection(attemptSearch);

      expect(route).toMatchObject({ kind: "attempt", review: "review-tree" });
    })
  );

  it.effect("answers a public section with its question preview", () =>
    Effect.gen(function* () {
      mocks.readTryoutQuestionPreview.mockResolvedValue(Option.some(preview));

      expect(yield* readSection()).toMatchObject({
        kind: "preview",
        preview: "preview-tree",
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
        mocks.readRequestToken.mockReturnValue(Effect.void);

        const route = yield* readSection();

        expect(route).toMatchObject({
          binding: null,
          kind: "catalog",
          setHref: "/try-out/id/snbt/2027/set-1",
        });
      })
  );

  it.effect(
    "binds the learner's current section to its start link and its set",
    () =>
      Effect.gen(function* () {
        mocks.readCurrentTryoutSection.mockReturnValue(
          Effect.succeed(
            attemptOf("current", {
              activeSectionPublicPath: SECTION,
              activeSetPublicPath: "try-out/id/snbt/2027/set-2",
            })
          )
        );

        const route = yield* readSection();

        expect(route).toMatchObject({
          binding: { startHref: `/${SECTION}` },
          kind: "catalog",
          setHref: "/try-out/id/snbt/2027/set-2",
        });
      })
  );

  it.effect(
    "binds a current section with no active section or set to the public links",
    () =>
      Effect.gen(function* () {
        mocks.readCurrentTryoutSection.mockReturnValue(
          Effect.succeed(attemptOf("current"))
        );

        const route = yield* readSection();

        expect(route).toMatchObject({
          binding: { startHref: null },
          setHref: "/try-out",
        });
      })
  );

  it.effect("holds a running current section with signed content", () =>
    Effect.gen(function* () {
      mocks.readCurrentTryoutSection.mockReturnValue(
        Effect.succeed(attemptOf("current", runningSigned))
      );

      const error = yield* Effect.flip(readSection());

      expect(error).toMatchObject({ _tag: "TryoutAttemptContentPending" });
    })
  );
});
