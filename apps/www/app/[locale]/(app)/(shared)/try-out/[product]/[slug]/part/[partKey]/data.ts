import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { getRenderableExercisesContent } from "@repo/contents/_lib/exercises/renderable";
import { fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";

/**
 * Loads the public tryout details for one part route from the Convex read model.
 *
 * Convex content sync can publish this read model after a web deployment, so the
 * cache must stay short-lived instead of allowing a temporary miss to become a
 * persistent prerendered 404.
 *
 * Docs: https://nextjs.org/docs/app/api-reference/functions/cacheLife#prerendering-behavior
 */
export async function getTryoutPartData(
  locale: Locale,
  product: TryoutProduct,
  slug: string,
  partKey: string
) {
  "use cache";

  cacheLife("seconds");

  const details = await fetchQuery(
    api.tryouts.queries.tryouts.getTryoutDetails,
    {
      locale,
      product,
      slug,
    }
  );

  if (!details) {
    return null;
  }

  const currentPart = details.parts.find((part) => part.partKey === partKey);

  if (!currentPart) {
    return null;
  }

  return {
    currentPart,
    details,
    partKeys: details.parts.map((part) => part.partKey),
  };
}

/** Loads one tryout exercise set as serializable exercise rows. */
export async function getTryoutExercises(locale: Locale, setSlug: string) {
  "use cache";

  cacheLife("max");

  return await Effect.runPromise(
    getRenderableExercisesContent(locale, setSlug)
  );
}
