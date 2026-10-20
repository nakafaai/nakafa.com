import "@tanstack/react-start/server-only";

import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Effect, Schema } from "effect";
import type { readCurrentTryoutSet } from "@/components/tryout/route/current";
import {
  renderTryoutPreview,
  renderTryoutReview,
} from "@/components/tryout/route/rendered.server";
import type { QuestionPreviewContent } from "@/lib/content/preview/question";
import { getOgUrl } from "@/lib/seo/social";

/**
 * A set or section that shows a learner's running attempt with its signed body. The
 * running body needs the runtime's body contract, which does not exist yet, so the
 * page stops here. A finished attempt renders its review instead.
 */
export class TryoutAttemptContentPending extends Schema.TaggedError<TryoutAttemptContentPending>()(
  "TryoutAttemptContentPending",
  { publicPath: Schema.String }
) {}

/** The parts of an attempt that its review reads: its ID, its signed content, and its state. */
type ReviewedAttempt = Pick<
  NonNullable<Effect.Success<ReturnType<typeof readCurrentTryoutSet>>>,
  "attemptId" | "content" | "initialState"
>;

/**
 * The head of a page bound to one attempt, or to a question preview. It names the
 * page and keeps it out of search results, as the reference's retained metadata does.
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
      title: input.title,
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
 * The terminal review of an attempt with signed content, rendered on the server. An
 * attempt without signed content has no review, and a running attempt with signed
 * content is pending until the runtime's body contract exists.
 */
export const readAttemptReview = Effect.fn("www.tryout.route.readReview")(
  function* (input: {
    readonly attempt: ReviewedAttempt;
    readonly locale: Locale;
    readonly publicPath: string;
  }) {
    const { attempt } = input;
    const { content, initialState } = attempt;
    if (content.kind !== "signed") {
      return null;
    }
    if (initialState.attempt.status === "in-progress") {
      return yield* new TryoutAttemptContentPending({
        publicPath: input.publicPath,
      });
    }
    const { runtime } = initialState;
    if (runtime === null) {
      return null;
    }
    return yield* Effect.promise(() =>
      renderTryoutReview({
        access: content,
        attemptId: attempt.attemptId,
        locale: input.locale,
        runtime,
      })
    );
  }
);
