import type { Locale } from "@repo/internationalization/src/locale";
import { Effect, Option } from "effect";
import { decodeTryoutBodies } from "@/components/tryout/content/body";
import type {
  readCurrentTryoutSection,
  readCurrentTryoutSet,
} from "@/components/tryout/route/current";
import { readCopy } from "@/lib/i18n/copy.server";
import { getOgUrl } from "@/lib/seo/social";

/** The question bodies an attempt's page read returned, as the set or the section reader holds them. */
type SurfaceAttempt = Pick<
  | Option.Option.Value<Effect.Success<ReturnType<typeof readCurrentTryoutSet>>>
  | Option.Option.Value<
      Effect.Success<ReturnType<typeof readCurrentTryoutSection>>
    >,
  "content"
>;

/**
 * The head of a page bound to one attempt. It names the
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
    const tTryouts = yield* readCopy({
      locale: input.locale,
      namespace: "Tryouts",
    });
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
 * The decoded question bodies of an attempt's page: the running section's, and once a section
 * finishes, the bodies its review reads, with the keys and explanations the learner may read. A page
 * the backend sends no bodies for has none.
 */
export const readAttemptContent = Effect.fn("www.tryout.route.readContent")(
  function* (input: { readonly attempt: SurfaceAttempt }) {
    if (input.attempt.content.length === 0) {
      return Option.none();
    }
    return Option.some(yield* decodeTryoutBodies(input.attempt.content));
  }
);
