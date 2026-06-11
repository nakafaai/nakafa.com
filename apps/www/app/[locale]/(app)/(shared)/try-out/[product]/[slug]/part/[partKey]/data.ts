import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { fetchQuery } from "convex/nextjs";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";

/**
 * Loads the public tryout details for one part route from the Convex read model.
 *
 * Convex content sync can publish this read model after a web deployment, so the
 * cache stays short-lived instead of letting a temporary miss become a
 * persistent prerendered 404.
 *
 * Docs: https://nextjs.org/docs/app/api-reference/functions/cacheLife#preset-cache-profiles
 */
export async function getTryoutPartData(
  locale: Locale,
  product: TryoutProduct,
  slug: string,
  partKey: string
) {
  "use cache";

  applyContentRuntimeCache();

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

/**
 * Loads one synced tryout exercise set from the Convex content read model.
 *
 * The rendered choices must stay close to the live Convex answer sheet used by
 * the client runtime because answer submission maps visible choices to option
 * keys by order.
 *
 * Docs: https://docs.convex.dev/client/react#fetching-data
 */
export async function getTryoutExercises(locale: Locale, setSlug: string) {
  "use cache";

  applyContentRuntimeCache();

  const exercises = await fetchQuery(
    api.exercises.queries.getRenderableRowsBySlug,
    {
      locale,
      slug: setSlug,
    }
  );

  if (!exercises) {
    throw new Error(`Synced exercise set is missing for tryout: ${setSlug}`);
  }

  return exercises;
}
