// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { readTryoutSetRoute } from "@/components/tryout/route/attempt.server";

const mocks = vi.hoisted(() => ({
  loadSignedTryoutContent: vi.fn(),
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
  renderTryoutQuestionBody: vi.fn(),
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
vi.mock("@/components/tryout/content/signed", () => ({
  loadSignedTryoutContent: mocks.loadSignedTryoutContent,
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
vi.mock("@/components/tryout/route/body.server", () => ({
  renderTryoutQuestionBody: mocks.renderTryoutQuestionBody,
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
const attemptSearch = { attemptId: "attempt-1" };

const NOT_FOUND = { kind: "notFound" };

type Search = Readonly<Record<string, string | undefined>>;

/** Reads the set URL of the fixture address with one search. */
const readSet = (search: Search = {}) =>
  readTryoutSetRoute({ ...setAddress, search });

const catalogSet = {
  entrySection: { sectionKey: "section-1" },
  set: { description: "Set", publicPath: SET, title: "Set 1" },
  sections: [{ publicPath: SECTION }],
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
/** The signed questions of a running attempt, as the content loader returns them. */
const signedQuestions = {
  answers: [],
  questions: [
    {
      content: "body-1",
      contentHash: "hash-1",
      sourcePath: "path-1",
      sourceRevision: "revision-1",
    },
  ],
};

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
  mocks.readRequestToken.mockReturnValue(Effect.succeedSome("token-1"));
  mocks.readPlayerMode.mockReturnValue("list");
  mocks.readServerTranslator.mockImplementation(() =>
    Promise.resolve((key: string) => key)
  );
  mocks.readTryoutQuestionPreview.mockReturnValue(Effect.succeedNone);
  mocks.renderTryoutPreview.mockResolvedValue("preview-tree");
  mocks.renderTryoutReview.mockResolvedValue("review-tree");
  mocks.loadSignedTryoutContent.mockReturnValue(
    Effect.succeed(signedQuestions)
  );
  mocks.renderTryoutQuestionBody.mockImplementation((question) =>
    Promise.resolve({ ...question, content: "rendered-body" })
  );
  mocks.readTryoutRouteHead.mockReturnValue(Effect.succeed(head));
  mocks.readTryoutSetPage.mockReturnValue(Effect.succeed(catalogSet));
  mocks.readTryoutSetAttemptPage.mockReturnValue(
    Effect.succeed(attemptOf("retained"))
  );
  mocks.readTryoutSectionAttemptPage.mockReturnValue(
    Effect.succeed(attemptOf("retained"))
  );
  mocks.readCurrentTryoutSet.mockReturnValue(Effect.succeedNone);
  mocks.readCurrentTryoutSection.mockReturnValue(Effect.succeedNone);
});

describe("readTryoutSetRoute", () => {
  it.effect("answers not found for an empty attempt or an unknown view", () =>
    Effect.gen(function* () {
      expect(yield* readSet({ attemptId: "" })).toEqual(NOT_FOUND);
      expect(yield* readSet({ view: "grid" })).toEqual(NOT_FOUND);
    })
  );

  it.effect("sends an attempt URL to sign-in when there is no session", () =>
    Effect.gen(function* () {
      mocks.readRequestToken.mockReturnValue(Effect.succeedNone);

      const route = yield* readSet(attemptSearch);

      expect(route).toEqual({
        href: expect.stringContaining("/en/auth?redirect="),
        kind: "signIn",
      });
      expect(mocks.setResponseHeader).toHaveBeenCalledExactlyOnceWith(
        "cache-control",
        "private, no-store"
      );
    })
  );

  it.effect("answers not found when the attempt is not the learner's own", () =>
    Effect.gen(function* () {
      mocks.readTryoutSetAttemptPage.mockReturnValue(
        Effect.succeed(attemptOf("current"))
      );

      expect(yield* readSet(attemptSearch)).toEqual(NOT_FOUND);
    })
  );

  it.effect("renders a running retained set with its signed questions", () =>
    Effect.gen(function* () {
      mocks.readTryoutSetAttemptPage.mockReturnValue(
        Effect.succeed(attemptOf("retained", runningSigned))
      );

      const route = yield* readSet(attemptSearch);

      expect(mocks.loadSignedTryoutContent).toHaveBeenCalledExactlyOnceWith(
        "attempt-1",
        signedContent
      );
      expect(route).toMatchObject({
        content: {
          questions: [{ content: "rendered-body", contentHash: "hash-1" }],
        },
        kind: "attempt",
        review: undefined,
      });
    })
  );

  it.effect("renders the review of a finished retained set", () =>
    Effect.gen(function* () {
      mocks.readTryoutSetAttemptPage.mockReturnValue(
        Effect.succeed(attemptOf("retained", finishedSigned))
      );

      const route = yield* readSet(attemptSearch);

      expect(route).toMatchObject({ kind: "attempt", review: "review-tree" });
      expect(route).toMatchObject({ content: null });
      expect(mocks.loadSignedTryoutContent).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "renders the learner's retained attempt with its own title and description",
    () =>
      Effect.gen(function* () {
        const route = yield* readSet({
          attemptId: "attempt-1",
          view: "single",
        });

        expect(route).toMatchObject({
          binding: { attemptId: "attempt-1", mode: "list" },
          head: {
            canonicalPath: "/en/try-out/id/snbt/2027/set-1",
            description: "Set",
            indexable: false,
            title: { absolute: "Set 1" },
          },
          kind: "attempt",
          restartTarget: { setPublicPath: SET },
        });
        expect(mocks.readPlayerMode).toHaveBeenCalledWith({
          kind: "valid",
          mode: "single",
        });
      })
  );

  it.effect(
    "falls back to the catalog description when the retained set has none",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSetAttemptPage.mockReturnValue(
          Effect.succeed(
            attemptOf("retained", {
              page: {
                section: { description: undefined, title: "Section 1" },
                sections: [],
                set: { description: undefined, title: "Set 1" },
              },
            })
          )
        );

        const route = yield* readSet(attemptSearch);

        expect(route).toMatchObject({
          head: { description: "metadata-description" },
        });
      })
  );

  it.effect("answers a public set with its question preview", () =>
    Effect.gen(function* () {
      mocks.readTryoutQuestionPreview.mockReturnValue(
        Effect.succeedSome(preview)
      );

      expect(yield* readSet()).toMatchObject({
        kind: "preview",
        preview: "preview-tree",
      });
    })
  );

  it.effect(
    "answers not found when the catalog has no set page or no head",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSetPage.mockReturnValueOnce(Effect.void);
        expect(yield* readSet()).toEqual(NOT_FOUND);

        mocks.readTryoutRouteHead.mockReturnValueOnce(Effect.succeedNone);
        expect(yield* readSet()).toEqual(NOT_FOUND);
      })
  );

  it.effect(
    "shows the catalog set with the start target when the learner has no session",
    () =>
      Effect.gen(function* () {
        mocks.readRequestToken.mockReturnValue(Effect.succeedNone);

        const route = yield* readSet();

        expect(route).toMatchObject({
          binding: null,
          content: null,
          kind: "catalog",
          restartTarget: { entrySection: { sectionKey: "section-1" } },
        });
      })
  );

  it.effect("renders a running current set with its signed questions", () =>
    Effect.gen(function* () {
      mocks.readCurrentTryoutSet.mockReturnValue(
        Effect.succeedSome(attemptOf("current", runningSigned))
      );

      const route = yield* readSet();

      expect(route).toMatchObject({
        binding: { attemptId: "attempt-1" },
        content: {
          questions: [{ content: "rendered-body", contentHash: "hash-1" }],
        },
        kind: "catalog",
        review: undefined,
      });
    })
  );

  it.effect("holds no review for a finished attempt without a runtime", () =>
    Effect.gen(function* () {
      mocks.readCurrentTryoutSet.mockReturnValue(
        Effect.succeedSome(
          attemptOf("current", {
            ...finishedSigned,
            initialState: { attempt: { status: "completed" }, runtime: null },
          })
        )
      );

      expect(yield* readSet()).toMatchObject({
        content: null,
        review: undefined,
      });
    })
  );

  it.effect("shows the running attempt in place of the catalog page", () =>
    Effect.gen(function* () {
      mocks.readCurrentTryoutSet.mockReturnValue(
        Effect.succeedSome(
          attemptOf("retained", {
            page: { set: { description: "Running", title: "Running set" } },
          })
        )
      );

      const route = yield* readSet();

      expect(route).toMatchObject({
        binding: { attemptId: "attempt-1" },
        kind: "catalog",
        page: { set: { description: "Running" } },
      });
    })
  );

  it.effect(
    "shows the catalog page with the learner's latest attempt when it is not running",
    () =>
      Effect.gen(function* () {
        mocks.readCurrentTryoutSet.mockReturnValue(
          Effect.succeedSome(attemptOf("current"))
        );

        const route = yield* readSet();

        expect(route).toMatchObject({
          content: null,
          kind: "catalog",
          page: catalogSet,
          restartTarget: { setPublicPath: SET },
        });
      })
  );
});
