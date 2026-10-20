import "@tanstack/react-start/server-only";

import {
  type Locale,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Clock, Effect, Option, Schema } from "effect";
import {
  type PlayerModeParam,
  readPlayerModeParam,
} from "@/components/player/mode";
import { readPlayerMode } from "@/components/player/server";
import {
  readTryoutSectionAttemptPage,
  readTryoutSectionPage,
  readTryoutSetAttemptPage,
  readTryoutSetPage,
} from "@/components/tryout/catalog/server";
import { readTryoutQuestionPreview } from "@/components/tryout/preview/read";
import { readTryoutRouteHead } from "@/components/tryout/route/catalog.server";
import {
  readCurrentTryoutSection,
  readCurrentTryoutSet,
} from "@/components/tryout/route/current";
import {
  createTryoutSetRestartTarget,
  selectTryoutSectionReturnHref,
} from "@/components/tryout/route/owner";
import {
  getTryoutAttemptAuthHref,
  getTryoutHref,
  getTryoutPublicPathHref,
  readTryoutRouteAttemptCapability,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";
import { keepPersonalResponse } from "@/components/tryout/route/response.server";
import { readRequestToken } from "@/components/tryout/route/token.server";
import { getOgUrl } from "@/lib/seo/social";
import { serverHandler } from "@/lib/server/fn";

/**
 * A set or section that shows a learner's attempt with rendered question
 * bodies. A loader cannot return those bodies, so the page stops here until the
 * renderer's body contract exists.
 */
class TryoutAttemptContentPending extends Schema.TaggedError<TryoutAttemptContentPending>()(
  "TryoutAttemptContentPending",
  { publicPath: Schema.String }
) {}

/** The learner's current or retained set attempt, as the set reader holds it. */
type SetAttemptPage = Effect.Success<ReturnType<typeof readCurrentTryoutSet>>;
/** The learner's current or retained section attempt, as the section reader holds it. */
type SectionAttemptPage = Effect.Success<
  ReturnType<typeof readCurrentTryoutSection>
>;

/**
 * Reads the attempt capability and the player view of one address. Either one
 * being invalid makes the page not found, as the reference answers it.
 */
function readAddressIntent(search: TryoutRouteSearchParams) {
  const capability = readTryoutRouteAttemptCapability(search);
  const view = readPlayerModeParam(search);
  if (capability.kind === "invalid" || view.kind === "invalid") {
    return Option.none();
  }
  return Option.some({
    attemptId: capability.kind === "valid" ? capability.attemptId : undefined,
    view,
  });
}

/**
 * The attempt state a page binds to its player: the attempt, its state, the view
 * the server resolved for the learner, and the page's section routes.
 */
const readSetBinding = Effect.fn("www.tryout.route.readSetBinding")(function* (
  attempt: NonNullable<SetAttemptPage>,
  view: PlayerModeParam
) {
  return {
    attemptId: attempt.attemptId,
    initialState: attempt.initialState,
    mode: yield* Effect.sync(() => readPlayerMode(view)),
    sectionRoutes: attempt.page.sections,
  };
});

/**
 * The section binding of a page: the attempt, its state, the resolved view, and
 * the start link of the section the attempt is on, when it has one.
 */
const readSectionBinding = Effect.fn("www.tryout.route.readSectionBinding")(
  function* (attempt: NonNullable<SectionAttemptPage>, view: PlayerModeParam) {
    return {
      attemptId: attempt.attemptId,
      initialState: attempt.initialState,
      mode: yield* Effect.sync(() => readPlayerMode(view)),
      startHref: attempt.activeSectionPublicPath
        ? getTryoutPublicPathHref(attempt.activeSectionPublicPath)
        : null,
    };
  }
);

/**
 * The head of a page bound to one attempt. It names the page and keeps it out
 * of search results, as the reference's retained metadata does.
 */
const readRetainedHead = Effect.fn("www.tryout.route.readRetainedHead")(
  function* (input: {
    readonly description: string | undefined;
    readonly locale: Locale;
    readonly publicPath: string;
    readonly title: string;
  }) {
    const tTryouts = yield* Effect.promise(() =>
      readServerTranslator({ locale: input.locale, namespace: "Tryouts" })
    );
    return {
      canonicalPath: `/${input.locale}/${input.publicPath}` as const,
      description: input.description ?? tTryouts("metadata-description"),
      image: getOgUrl(input.locale, input.publicPath),
      indexable: false,
      title: input.title,
    };
  }
);

/**
 * Resolves one set URL for the request. A URL bound to an attempt answers for
 * that attempt only: no session sends the learner to sign-in with 307, and an
 * attempt that is not theirs is not found. A public URL shows its catalog view,
 * and the learner's latest attempt on the set when they have one.
 */
export const readTryoutSetRoute = Effect.fn("www.tryout.route.readSet")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly locale: Locale;
    readonly search: TryoutRouteSearchParams;
    readonly set: string;
    readonly track: string;
  }) {
    yield* keepPersonalResponse;
    const intent = readAddressIntent(input.search);
    if (Option.isNone(intent)) {
      return { kind: "notFound" as const };
    }
    const locale = input.locale;
    const route = {
      country: input.country,
      exam: input.exam,
      locale,
      set: input.set,
      track: input.track,
    };
    const setPath = getTryoutHref(route).slice(1);
    const token = yield* readRequestToken();
    if (intent.value.attemptId !== undefined) {
      return yield* readRetainedSetRoute(
        {
          attemptId: intent.value.attemptId,
          locale,
          publicPath: setPath,
          route,
          token,
        },
        intent.value.view
      );
    }
    const preview = yield* Effect.promise(() =>
      readTryoutQuestionPreview(locale, setPath)
    );
    if (Option.isSome(preview)) {
      return yield* new TryoutAttemptContentPending({ publicPath: setPath });
    }
    const page = yield* readTryoutSetPage(locale, setPath);
    if (!page) {
      return { kind: "notFound" as const };
    }
    const head = yield* readTryoutRouteHead({
      kind: "set",
      locale,
      publicPath: setPath,
    });
    if (Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    const attempt = token
      ? yield* readCurrentTryoutSet(token, {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale,
          setKey: page.set.setKey,
          trackKey: page.set.trackKey,
        })
      : null;
    if (attempt?.content.kind === "signed") {
      return yield* new TryoutAttemptContentPending({ publicPath: setPath });
    }
    const running = attempt?.kind === "retained" ? attempt : null;
    return {
      binding: attempt
        ? yield* readSetBinding(attempt, intent.value.view)
        : null,
      head: head.value,
      kind: "catalog" as const,
      now: yield* Clock.currentTimeMillis,
      page: running ? running.page : page,
      restartTarget: attempt
        ? attempt.restartTarget
        : createTryoutSetRestartTarget(page),
      route,
      view: intent.value.view,
    };
  }
);

/** The coordinates of one set page. */
const SetRouteSchema = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: LocaleSchema,
  set: Schema.String,
  track: Schema.String,
});

/** A set URL bound to one attempt, with the request's learner token when there is one. */
const RetainedSetRequestSchema = Schema.Struct({
  attemptId: Schema.String,
  locale: LocaleSchema,
  publicPath: Schema.String,
  route: SetRouteSchema,
  token: Schema.UndefinedOr(Schema.String),
});

const readRetainedSetRoute = Effect.fn("www.tryout.route.readRetainedSet")(
  function* (
    input: typeof RetainedSetRequestSchema.Type,
    view: PlayerModeParam
  ) {
    if (input.token === undefined) {
      return {
        href: getTryoutAttemptAuthHref(
          input.locale,
          input.publicPath,
          input.attemptId
        ),
        kind: "signIn" as const,
      };
    }
    const attempt = yield* readTryoutSetAttemptPage(input.token, {
      attemptId: input.attemptId,
      kind: "retained",
      locale: input.locale,
      publicPath: input.publicPath,
    });
    if (attempt?.kind !== "retained") {
      return { kind: "notFound" as const };
    }
    if (attempt.content.kind === "signed") {
      return yield* new TryoutAttemptContentPending({
        publicPath: input.publicPath,
      });
    }
    return {
      binding: yield* readSetBinding(attempt, view),
      head: yield* readRetainedHead({
        description: attempt.page.set.description,
        locale: input.locale,
        publicPath: input.publicPath,
        title: attempt.page.set.title,
      }),
      kind: "attempt" as const,
      now: yield* Clock.currentTimeMillis,
      page: attempt.page,
      restartTarget: attempt.restartTarget,
      route: input.route,
      view,
    };
  }
);

/**
 * Resolves one section URL for the request, with the rules of its set: a URL
 * bound to an attempt answers for that attempt only, and a public URL shows the
 * section's catalog view with the learner's attempt through it, when there is one.
 */
export const readTryoutSectionRoute = Effect.fn("www.tryout.route.readSection")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly locale: Locale;
    readonly search: TryoutRouteSearchParams;
    readonly section: string;
    readonly set: string;
    readonly track: string;
  }) {
    yield* keepPersonalResponse;
    const intent = readAddressIntent(input.search);
    if (Option.isNone(intent)) {
      return { kind: "notFound" as const };
    }
    const locale = input.locale;
    const route = {
      country: input.country,
      exam: input.exam,
      locale,
      section: input.section,
      set: input.set,
      track: input.track,
    };
    const sectionPath = getTryoutHref(route).slice(1);
    const setHref = getTryoutHref({
      country: input.country,
      exam: input.exam,
      set: input.set,
      track: input.track,
    });
    const token = yield* readRequestToken();
    if (intent.value.attemptId !== undefined) {
      return yield* readRetainedSectionRoute(
        {
          attemptId: intent.value.attemptId,
          locale,
          publicPath: sectionPath,
          route,
          setHref,
          token,
        },
        intent.value.view
      );
    }
    const preview = yield* Effect.promise(() =>
      readTryoutQuestionPreview(locale, sectionPath)
    );
    if (Option.isSome(preview)) {
      return yield* new TryoutAttemptContentPending({
        publicPath: sectionPath,
      });
    }
    const page = yield* readTryoutSectionPage(locale, sectionPath);
    if (!page) {
      return { kind: "notFound" as const };
    }
    const head = yield* readTryoutRouteHead({
      kind: "section",
      locale,
      publicPath: sectionPath,
    });
    if (Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    const attempt = token
      ? yield* readCurrentTryoutSection(token, {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale,
          sectionKey: page.section.sectionKey,
          setKey: page.set.setKey,
          trackKey: page.set.trackKey,
        })
      : null;
    if (attempt?.content.kind === "signed") {
      return yield* new TryoutAttemptContentPending({
        publicPath: sectionPath,
      });
    }
    return {
      binding: attempt
        ? yield* readSectionBinding(attempt, intent.value.view)
        : null,
      head: head.value,
      kind: "catalog" as const,
      now: yield* Clock.currentTimeMillis,
      page: attempt ? attempt.page : page,
      route,
      setHref: selectTryoutSectionReturnHref({
        attemptPage: attempt,
        publicHref: setHref,
      }),
      view: intent.value.view,
    };
  }
);

/** The coordinates of one section page. */
const SectionRouteSchema = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: LocaleSchema,
  section: Schema.String,
  set: Schema.String,
  track: Schema.String,
});

/** A section URL bound to one attempt, with the set page it returns to. */
const RetainedSectionRequestSchema = Schema.Struct({
  attemptId: Schema.String,
  locale: LocaleSchema,
  publicPath: Schema.String,
  route: SectionRouteSchema,
  setHref: Schema.String,
  token: Schema.UndefinedOr(Schema.String),
});

const readRetainedSectionRoute = Effect.fn(
  "www.tryout.route.readRetainedSection"
)(function* (
  input: typeof RetainedSectionRequestSchema.Type,
  view: PlayerModeParam
) {
  if (input.token === undefined) {
    return {
      href: getTryoutAttemptAuthHref(
        input.locale,
        input.publicPath,
        input.attemptId
      ),
      kind: "signIn" as const,
    };
  }
  const attempt = yield* readTryoutSectionAttemptPage(input.token, {
    attemptId: input.attemptId,
    kind: "retained",
    locale: input.locale,
    publicPath: input.publicPath,
  });
  if (attempt?.kind !== "retained") {
    return { kind: "notFound" as const };
  }
  if (attempt.content.kind === "signed") {
    return yield* new TryoutAttemptContentPending({
      publicPath: input.publicPath,
    });
  }
  return {
    binding: yield* readSectionBinding(attempt, view),
    head: yield* readRetainedHead({
      description: attempt.page.section.description,
      locale: input.locale,
      publicPath: input.publicPath,
      title: attempt.page.section.title,
    }),
    kind: "attempt" as const,
    now: yield* Clock.currentTimeMillis,
    page: attempt.page,
    route: input.route,
    setHref: selectTryoutSectionReturnHref({
      attemptPage: attempt,
      publicHref: input.setHref,
    }),
    view,
  };
});

/** One set page for its learner: the catalog view, or the attempt bound to the URL. */
export const readTryoutSetHandler = serverHandler(readTryoutSetRoute);

/** One section page for its learner: the catalog view, or the attempt bound to the URL. */
export const readTryoutSectionHandler = serverHandler(readTryoutSectionRoute);
