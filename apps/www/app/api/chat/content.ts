import { getCanonicalNakafaContentUrl } from "@repo/ai/nina/runtime/page";
import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";

/**
 * Builds the canonical public Nakafa URL for the current chat page projection.
 */
export function getCanonicalCurrentPageContentUrl({
  locale,
  slug,
}: {
  locale: Locale;
  slug: string;
}) {
  return getCanonicalNakafaContentUrl(`/${locale}/${cleanSlug(slug)}`);
}
