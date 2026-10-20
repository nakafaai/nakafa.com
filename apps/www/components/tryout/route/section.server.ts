import "@tanstack/react-start/server-only";

import {
  type Locale,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { Clock, Effect, Option, Schema } from "effect";
import type { PlayerModeParam } from "@/components/player/mode";
import { readPlayerMode } from "@/components/player/server";
import {
  readTryoutSectionAttemptPage,
  readTryoutSectionPage,
} from "@/components/tryout/catalog/server";
import { readTryoutQuestionPreview } from "@/components/tryout/preview/read";
import { readTryoutRouteHead } from "@/components/tryout/route/catalog.server";
import { readCurrentTryoutSection } from "@/components/tryout/route/current";
import { readAddressIntent } from "@/components/tryout/route/intent";
import { selectTryoutSectionReturnHref } from "@/components/tryout/route/owner";
import {
  getTryoutAttemptAuthHref,
  getTryoutHref,
  getTryoutPublicPathHref,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";
import { keepPersonalResponse } from "@/components/tryout/route/response.server";
import {
  readAttemptReview,
  readPreviewRoute,
  readRetainedHead,
} from "@/components/tryout/route/surface.server";
import { readRequestToken } from "@/components/tryout/route/token.server";

/** The learner's current or retained section attempt, as the section reader holds it. */
type SectionAttemptPage = Effect.Success<
  ReturnType<typeof readCurrentTryoutSection>
>;

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
      return yield* readPreviewRoute({
        locale,
        preview: preview.value,
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
    return {
      binding: attempt
        ? yield* readSectionBinding(attempt, intent.value.view)
        : null,
      head: head.value,
      kind: "catalog" as const,
      now: yield* Clock.currentTimeMillis,
      page: attempt ? attempt.page : page,
      review: attempt
        ? Option.getOrUndefined(
            yield* readAttemptReview({
              attempt,
              locale,
              publicPath: sectionPath,
            })
          )
        : undefined,
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
    review: Option.getOrUndefined(
      yield* readAttemptReview({
        attempt,
        locale: input.locale,
        publicPath: input.publicPath,
      })
    ),
    route: input.route,
    setHref: selectTryoutSectionReturnHref({
      attemptPage: attempt,
      publicHref: input.setHref,
    }),
    view,
  };
});
