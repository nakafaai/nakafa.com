import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { revalidatePath } from "next/cache";
import type { Locale } from "next-intl";

/** Identifies the overview pages shared by one tryout product. */
export interface TryoutOverviewInput {
  locale: Locale;
  product: TryoutProduct;
}

/** Identifies one full tryout set route family, including every part page. */
export interface TryoutSetRouteInput extends TryoutOverviewInput {
  partKeys: readonly string[];
  tryoutSlug: string;
}

type TryoutSetPathInput = TryoutOverviewInput & {
  tryoutSlug: string;
};

/** Builds the localized hub path for the tryout landing page. */
function getHubPath(locale: Locale) {
  return `/${locale}/try-out`;
}

/** Builds the localized product page path for one tryout product. */
function getProductPath({ locale, product }: TryoutOverviewInput) {
  return `${getHubPath(locale)}/${product}`;
}

/** Builds the localized set page path for one tryout slug. */
function getSetPath({ locale, product, tryoutSlug }: TryoutSetPathInput) {
  return `${getProductPath({ locale, product })}/${tryoutSlug}`;
}

/** Builds the localized part page path for one tryout part key. */
function getPartPath({
  locale,
  partKey,
  product,
  tryoutSlug,
}: TryoutSetPathInput & {
  partKey: string;
}) {
  return `${getSetPath({ locale, product, tryoutSlug })}/part/${partKey}`;
}

/** Revalidates the shared hub and product pages that summarize tryout progress. */
export function revalidateTryoutOverview(input: TryoutOverviewInput) {
  revalidatePath(getHubPath(input.locale));
  revalidatePath(getProductPath(input));
}

/** Revalidates the set page and every part page belonging to one tryout. */
export function revalidateTryoutSet(input: TryoutSetRouteInput) {
  revalidatePath(getSetPath(input));

  for (const partKey of input.partKeys) {
    revalidatePath(
      getPartPath({
        locale: input.locale,
        partKey,
        product: input.product,
        tryoutSlug: input.tryoutSlug,
      })
    );
  }
}
