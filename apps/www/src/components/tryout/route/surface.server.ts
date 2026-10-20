import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Effect, Option } from "effect";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import { renderTryoutQuestionBody } from "@/components/tryout/route/body.server";
import type { readCurrentTryoutSet } from "@/components/tryout/route/current";
import {
  renderTryoutPreview,
  renderTryoutReview,
} from "@/components/tryout/route/rendered.server";
import type { QuestionPreviewContent } from "@/lib/content/preview/question";
import { getOgUrl } from "@/lib/seo/social";

/**
 * The parts of an attempt that its running content and its review read: its ID,
 * its signed content, and its state.
 */
type SurfaceAttempt = Pick<
  Option.Option.Value<Effect.Success<ReturnType<typeof readCurrentTryoutSet>>>,
  "attemptId" | "content" | "initialState"
>;

/**
 * The head of a page bound to one attempt, or to a question preview. It names the
 * page with its absolute title and keeps it out of search results, as the
 * reference's retained metadata does.
 */
export const readRetainedHead = Effect.fn("www.tryout.route.readRetainedHead")(
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
      title: { absolute: input.title },
    };
  }
);

/**
 * The page of one question preview, which the reference renders in place of the set
 * or the section: the preview's own tree, and the head of its section.
 */
export const readPreviewRoute = Effect.fn("www.tryout.route.readPreview")(
  function* (input: {
    readonly locale: Locale;
    readonly preview: QuestionPreviewContent;
    readonly publicPath: string;
  }) {
    const section = input.preview.target.section;
    return {
      head: yield* readRetainedHead({
        description: section.description,
        locale: input.locale,
        publicPath: input.publicPath,
        title: section.title,
      }),
      kind: "preview" as const,
      preview: yield* Effect.promise(() => renderTryoutPreview(input.preview)),
    };
  }
);

/**
 * The signed question bodies of a running attempt, verified and rendered on the
 * server. A finished attempt, or one without signed content, has none.
 */
export const readAttemptContent = Effect.fn("www.tryout.route.readContent")(
  function* (input: { readonly attempt: SurfaceAttempt }) {
    const { content, initialState } = input.attempt;
    if (
      content.kind !== "signed" ||
      initialState.attempt.status !== "in-progress"
    ) {
      return Option.none();
    }
    const signed = yield* loadSignedTryoutContent(
      input.attempt.attemptId,
      content
    );
    const questions = yield* Effect.forEach(
      signed.questions,
      (question) => Effect.promise(() => renderTryoutQuestionBody(question)),
      { concurrency: "unbounded" }
    );
    return Option.some({ questions });
  }
);

/** The server-rendered review tree of one finished attempt. */
type RenderedReview = Awaited<ReturnType<typeof renderTryoutReview>>;

/**
 * The terminal review of a finished attempt with signed content and a runtime,
 * rendered on the server. A running attempt has no review: its content renders
 * instead. An attempt without signed content, or without a runtime, has none.
 */
export const readAttemptReview = Effect.fn("www.tryout.route.readReview")(
  function* (input: {
    readonly attempt: SurfaceAttempt;
    readonly locale: Locale;
  }) {
    const { attempt } = input;
    const { content, initialState } = attempt;
    if (
      content.kind !== "signed" ||
      initialState.attempt.status === "in-progress"
    ) {
      return Option.none<RenderedReview>();
    }
    const runtime = Option.fromNullishOr(initialState.runtime);
    if (Option.isNone(runtime)) {
      return Option.none<RenderedReview>();
    }
    return Option.some(
      yield* Effect.promise(() =>
        renderTryoutReview({
          access: content,
          attemptId: attempt.attemptId,
          locale: input.locale,
          runtime: runtime.value,
        })
      )
    );
  }
);
