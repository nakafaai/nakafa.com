import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";

/** Builds the relative href for the tryout hub. */
export function getTryoutHubHref() {
  return "/try-out";
}

/** Builds the relative href for one tryout product catalog. */
export function getTryoutProductHref(product: TryoutProduct) {
  return `${getTryoutHubHref()}/${product}`;
}

/** Builds the relative href for one tryout set page. */
export function getTryoutSetHref({
  product,
  tryoutSlug,
}: {
  product: TryoutProduct;
  tryoutSlug: string;
}) {
  return `${getTryoutProductHref(product)}/${tryoutSlug}`;
}

/** Builds the relative href for one tryout part page. */
export function getTryoutPartHref({
  partKey,
  product,
  tryoutSlug,
}: {
  partKey: string;
  product: TryoutProduct;
  tryoutSlug: string;
}) {
  return `${getTryoutSetHref({ product, tryoutSlug })}/part/${partKey}`;
}

/** Appends the selected historical attempt to one tryout route when present. */
export function getTryoutHistoryHref(
  pathname: string,
  attemptId?: string | null
) {
  if (!attemptId) {
    return pathname;
  }

  const searchParams = new URLSearchParams({
    attempt: attemptId,
  });

  return `${pathname}?${searchParams.toString()}`;
}
