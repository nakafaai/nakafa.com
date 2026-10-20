import "@tanstack/react-start/server-only";

import {
  type Locale,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { Clock, Effect, Option, Schema } from "effect";
import {
  type PlayerModeParam,
  readPlayerModeParam,
} from "@/components/player/mode";
import { readPlayerMode } from "@/components/player/server";
import {
  readTryoutSetAttemptPage,
  readTryoutSetPage,
} from "@/components/tryout/catalog/server";
import { readTryoutQuestionPreview } from "@/components/tryout/preview/read";
import { readTryoutRouteHead } from "@/components/tryout/route/catalog.server";
import { readCurrentTryoutSet } from "@/components/tryout/route/current";
import { createTryoutSetRestartTarget } from "@/components/tryout/route/owner";
import {
  getTryoutAttemptAuthHref,
  getTryoutHref,
  readTryoutRouteAttemptCapability,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";
import { keepPersonalResponse } from "@/components/tryout/route/response.server";
import {
  readAttemptReview,
  readPreviewRoute,
  readRetainedHead,
} from "@/components/tryout/route/surface.server";
import { readRequestToken } from "@/components/tryout/route/token.server";

/** The learner's current or retained set attempt, as the set reader holds it. */
type SetAttemptPage = Effect.Success<ReturnType<typeof readCurrentTryoutSet>>;
/**
 * Reads the attempt capability and the player view of one address. Either one
 * being invalid makes the page not found, as the reference answers it.
 */
export function readAddressIntent(search: TryoutRouteSearchParams) {
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
      return yield* readPreviewRoute({
        locale,
        preview: preview.value,
        publicPath: setPath,
      });
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
      review: attempt
        ? yield* readAttemptReview({ attempt, locale, publicPath: setPath })
        : null,
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
      review: yield* readAttemptReview({
        attempt,
        locale: input.locale,
        publicPath: input.publicPath,
      }),
      route: input.route,
      view,
    };
  }
);
