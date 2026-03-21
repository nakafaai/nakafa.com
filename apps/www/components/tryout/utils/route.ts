import { isTryoutProduct } from "@repo/backend/convex/tryouts/products";
import type { TryoutAttemptParams } from "@/components/tryout/utils/attempt-params";

export type TryoutAttemptRoute = Pick<
  TryoutAttemptParams,
  "product" | "tryoutSlug"
>;

/**
 * Returns the tryout identifiers for pages that can enter focus mode.
 *
 * Supported routes:
 * - `/try-out/[product]/[slug]`
 * - `/try-out/[product]/[slug]/part/[partKey]`
 */
export function getTryoutAttemptRoute(
  pathname: string
): TryoutAttemptRoute | null {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "try-out") {
    return null;
  }

  const product = segments[1];
  const tryoutSlug = segments[2];

  if (!(product && tryoutSlug && isTryoutProduct(product))) {
    return null;
  }

  if (segments.length === 3) {
    return {
      product,
      tryoutSlug,
    };
  }

  const isPartRoute =
    segments.length === 5 && segments[3] === "part" && Boolean(segments[4]);

  if (!isPartRoute) {
    return null;
  }

  return {
    product,
    tryoutSlug,
  };
}
