// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  readTryoutSectionRoute,
  readTryoutSetRoute,
} from "@/components/tryout/route/attempt.server";

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
vi.mock("@/components/player/server", () => ({
  readPlayerMode: mocks.readPlayerMode,
}));
vi.mock("@/components/tryout/catalog/server", () => ({
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

/** Reads the set URL of the fixture address with one search. */
const readSet = (search: Search = {}) =>
  readTryoutSetRoute({ ...setAddress, search });

/** Reads the section URL of the fixture address with one search. */
const readSection = (search: Search = {}) =>
  readTryoutSectionRoute({ ...sectionAddress, search });

const catalogSet = {
  entrySection: { sectionKey: "section-1" },
  set: { description: "Set", publicPath: SET, title: "Set 1" },
  sections: [{ publicPath: SECTION }],
};
const catalogSection = {
  section: { description: "Section", publicPath: SECTION, title: "Section 1" },
  set: { countryKey: "id", examKey: "snbt", setKey: "set-1", trackKey: "2027" },
};

/** Signed content of an attempt, which the review and the running body read. */
const signedContent = { answers: [], kind: "signed" };
/** The runtime that a finished attempt's review renders. */
const runtime = { questions: [] };
/** A running attempt with signed content, whose body waits for the runtime's contract. */
const runningSigned = {
  content: signedContent,
  initialState: { attempt: { status: "in-progress" } },
};
/** A finished attempt with signed content, whose review renders on the server. */
const finishedSigned = {
  content: signedContent,
  initialState: { attempt: { status: "completed" }, runtime },
};
/** One question preview, as the preview reader answers it for its section. */
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
  mocks.readTryoutSetPage.mockReturnValue(Effect.succeed(catalogSet));
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

describe("readTryoutSetRoute", () => {
  it.effect("answers not found for an empty attempt or an unknown view", () =>
    Effect.gen(function* () {
      expect(yield* readSet({ attemptId: "" })).toEqual(NOT_FOUND);
      expect(yield* readSet({ view: "grid" })).toEqual(NOT_FOUND);
    })
  );

  it.effect("sends an attempt URL to sign-in when there is no session", () =>
    Effect.gen(function* () {
      mocks.readRequestToken.mockReturnValue(Effect.void);

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

  it.effect(
    "holds a running retained attempt with signed content until its body contract exists",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSetAttemptPage.mockReturnValue(
          Effect.succeed(attemptOf("retained", runningSigned))
        );

        const error = yield* Effect.flip(readSet(attemptSearch));

        expect(error).toMatchObject({
          _tag: "TryoutAttemptContentPending",
          publicPath: SET,
        });
      })
  );

  it.effect(
    "renders the review of a finished retained attempt with signed content",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSetAttemptPage.mockReturnValue(
          Effect.succeed(attemptOf("retained", finishedSigned))
        );

        const route = yield* readSet(attemptSearch);

        expect(route).toMatchObject({ kind: "attempt", review: "review-tree" });
        expect(mocks.renderTryoutReview).toHaveBeenCalledExactlyOnceWith({
          access: signedContent,
          attemptId: "attempt-1",
          locale: "en",
          runtime,
        });
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
            title: "Set 1",
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

  it.effect(
    "answers a public set that a preview answers with the preview",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutQuestionPreview.mockResolvedValue(Option.some(preview));

        const route = yield* readSet();

        expect(route).toMatchObject({
          head: { indexable: false, title: "Question 1" },
          kind: "preview",
          preview: "preview-tree",
        });
        expect(mocks.renderTryoutPreview).toHaveBeenCalledExactlyOnceWith(
          preview
        );
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
        mocks.readRequestToken.mockReturnValue(Effect.void);

        const route = yield* readSet();

        expect(route).toMatchObject({
          binding: null,
          kind: "catalog",
          restartTarget: { entrySection: { sectionKey: "section-1" } },
        });
      })
  );

  it.effect("holds a learner's current running set with signed content", () =>
    Effect.gen(function* () {
      mocks.readCurrentTryoutSet.mockReturnValue(
        Effect.succeed(attemptOf("current", runningSigned))
      );

      const error = yield* Effect.flip(readSet());

      expect(error).toMatchObject({ _tag: "TryoutAttemptContentPending" });
    })
  );

  it.effect("holds no review for a finished attempt without its runtime", () =>
    Effect.gen(function* () {
      mocks.readCurrentTryoutSet.mockReturnValue(
        Effect.succeed(
          attemptOf("current", {
            content: signedContent,
            initialState: { attempt: { status: "completed" }, runtime: null },
          })
        )
      );

      const route = yield* readSet();

      expect(route).toMatchObject({ kind: "catalog", review: null });
      expect(mocks.renderTryoutReview).not.toHaveBeenCalled();
    })
  );

  it.effect("renders the review of a learner's finished current set", () =>
    Effect.gen(function* () {
      mocks.readCurrentTryoutSet.mockReturnValue(
        Effect.succeed(attemptOf("current", finishedSigned))
      );

      const route = yield* readSet();

      expect(route).toMatchObject({ kind: "catalog", review: "review-tree" });
    })
  );

  it.effect("shows the running attempt in place of the catalog page", () =>
    Effect.gen(function* () {
      mocks.readCurrentTryoutSet.mockReturnValue(
        Effect.succeed(
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
          Effect.succeed(attemptOf("current"))
        );

        const route = yield* readSet();

        expect(route).toMatchObject({
          kind: "catalog",
          page: catalogSet,
          restartTarget: { setPublicPath: SET },
        });
      })
  );
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

  it.effect(
    "holds a running retained section attempt with signed content",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutSectionAttemptPage.mockReturnValue(
          Effect.succeed(attemptOf("retained", runningSigned))
        );

        const error = yield* Effect.flip(readSection(attemptSearch));

        expect(error).toMatchObject({ _tag: "TryoutAttemptContentPending" });
      })
  );

  it.effect("renders the review of a finished retained section attempt", () =>
    Effect.gen(function* () {
      mocks.readTryoutSectionAttemptPage.mockReturnValue(
        Effect.succeed(attemptOf("retained", finishedSigned))
      );

      const route = yield* readSection(attemptSearch);

      expect(route).toMatchObject({ kind: "attempt", review: "review-tree" });
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
          head: { description: "Section", title: "Section 1" },
        });
      })
  );

  it.effect(
    "answers a public section that a preview answers with the preview",
    () =>
      Effect.gen(function* () {
        mocks.readTryoutQuestionPreview.mockResolvedValue(Option.some(preview));

        const route = yield* readSection();

        expect(route).toMatchObject({
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

  it.effect(
    "holds a learner's current running section with signed content",
    () =>
      Effect.gen(function* () {
        mocks.readCurrentTryoutSection.mockReturnValue(
          Effect.succeed(attemptOf("current", runningSigned))
        );

        const error = yield* Effect.flip(readSection());

        expect(error).toMatchObject({ _tag: "TryoutAttemptContentPending" });
      })
  );
});
