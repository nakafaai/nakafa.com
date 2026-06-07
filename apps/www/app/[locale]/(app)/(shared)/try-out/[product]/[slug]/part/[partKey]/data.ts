import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { fetchQuery } from "convex/nextjs";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";

/** Loads the public tryout details for one part route inside a cacheable scope. */
export async function getTryoutPartData(
  locale: Locale,
  product: TryoutProduct,
  slug: string,
  partKey: string
) {
  "use cache";

  cacheLife("max");

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

/** Loads one synced tryout exercise set from the Convex content read model. */
export async function getTryoutExercises(locale: Locale, setSlug: string) {
  "use cache";

  cacheLife("max");

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
