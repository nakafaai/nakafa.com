import {
  type Locale,
  LocaleSchema,
} from "@repo/internationalization/src/locale";
import { Clock, Effect, Option, Schema } from "effect";
import type { PlayerModeParam } from "@/components/player/mode";
import { readPlayerMode } from "@/components/player/mode.server";
import {
  readTryoutSetAttemptPage,
  readTryoutSetPage,
} from "@/components/tryout/catalog/source.server";
import { readTryoutQuestionPreview } from "@/components/tryout/preview/read";
import { readTryoutRouteHead } from "@/components/tryout/route/catalog.server";
import { readCurrentTryoutSet } from "@/components/tryout/route/current";
import { readAddressIntent } from "@/components/tryout/route/intent";
import { createTryoutSetRestartTarget } from "@/components/tryout/route/owner";
import {
  getTryoutAttemptAuthHref,
  getTryoutHref,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";
import { keepPersonalResponse } from "@/components/tryout/route/response.server";
import {
  readAttemptContent,
  readAttemptReview,
  readPreviewRoute,
  readRetainedHead,
} from "@/components/tryout/route/surface.server";
import { readRequestToken } from "@/components/tryout/route/token.server";
import { serverHandler } from "@/lib/server/fn";

/** The learner's current or retained set attempt, as the set reader holds it. */
type SetAttempt = Option.Option.Value<
  Effect.Success<ReturnType<typeof readCurrentTryoutSet>>
>;

/**
 * The attempt state a page binds to its player: the attempt, its state, the view
 * the server resolved for the learner, and the page's section routes.
 */
const readSetBinding = Effect.fn("www.tryout.route.readSetBinding")(function* (
  attempt: SetAttempt,
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
    const preview = yield* readTryoutQuestionPreview(locale, setPath);
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
    const attempt = Option.isNone(token)
      ? Option.none<SetAttempt>()
      : yield* readCurrentTryoutSet(token.value, {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale,
          setKey: page.set.setKey,
          trackKey: page.set.trackKey,
        });
    const running = Option.filter(
      attempt,
      (value) => value.kind === "retained"
    );
    const binding = yield* Effect.transposeOption(
      Option.map(attempt, (value) => readSetBinding(value, intent.value.view))
    );
    const content = Option.isSome(attempt)
      ? yield* readAttemptContent({ attempt: attempt.value })
      : Option.none();
    const review = Option.isSome(attempt)
      ? yield* readAttemptReview({ attempt: attempt.value, locale })
      : Option.none();
    const restartTarget = Option.match(attempt, {
      onNone: () => createTryoutSetRestartTarget(page),
      onSome: (value) => Option.fromNullishOr(value.restartTarget),
    });
    return {
      binding: Option.getOrNull(binding),
      content: Option.getOrNull(content),
      head: head.value,
      kind: "catalog" as const,
      now: yield* Clock.currentTimeMillis,
      page: Option.match(running, {
        onNone: () => page,
        onSome: (value) => value.page,
      }),
      restartTarget: Option.getOrNull(restartTarget),
      review: Option.getOrUndefined(review),
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
  token: Schema.Option(Schema.String),
});

const readRetainedSetRoute = Effect.fn("www.tryout.route.readRetainedSet")(
  function* (
    input: typeof RetainedSetRequestSchema.Type,
    view: PlayerModeParam
  ) {
    if (Option.isNone(input.token)) {
      return {
        href: getTryoutAttemptAuthHref(
          input.locale,
          input.publicPath,
          input.attemptId
        ),
        kind: "signIn" as const,
      };
    }
    const attempt = yield* readTryoutSetAttemptPage(input.token.value, {
      attemptId: input.attemptId,
      kind: "retained",
      locale: input.locale,
      publicPath: input.publicPath,
    });
    if (attempt?.kind !== "retained") {
      return { kind: "notFound" as const };
    }
    const restartTarget = Option.fromNullishOr(attempt.restartTarget);
    return {
      binding: yield* readSetBinding(attempt, view),
      content: Option.getOrNull(yield* readAttemptContent({ attempt })),
      head: yield* readRetainedHead({
        description: attempt.page.set.description,
        locale: input.locale,
        publicPath: input.publicPath,
        title: attempt.page.set.title,
      }),
      kind: "attempt" as const,
      now: yield* Clock.currentTimeMillis,
      page: attempt.page,
      restartTarget: Option.getOrNull(restartTarget),
      review: Option.getOrUndefined(
        yield* readAttemptReview({
          attempt,
          locale: input.locale,
        })
      ),
      route: input.route,
      view,
    };
  }
);

/** One set page for its learner: the catalog view, or the attempt bound to the URL. */
export const readTryoutSetHandler = serverHandler(readTryoutSetRoute);
