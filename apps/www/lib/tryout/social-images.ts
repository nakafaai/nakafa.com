import type { Locale } from "next-intl";
import { getOgUrl } from "@/lib/utils/metadata";

const TRYOUT_SOCIAL_IMAGE_DIRECTORY = "/open-graph/tryout";

interface TryoutExamSocialImageInput {
  readonly countryKey: string;
  readonly examKey: string;
  readonly locale: Locale;
  readonly publicPath: string;
}

/**
 * Resolves reviewed exam artwork while preserving generated images for every
 * signed route without a matching static asset.
 */
export function getTryoutExamSocialImage({
  countryKey,
  examKey,
  locale,
  publicPath,
}: TryoutExamSocialImageInput) {
  if (countryKey !== "indonesia") {
    return getOgUrl(locale, publicPath);
  }

  if (examKey !== "snbt" && examKey !== "tka") {
    return getOgUrl(locale, publicPath);
  }

  return `${TRYOUT_SOCIAL_IMAGE_DIRECTORY}/${countryKey}/${locale}-${examKey}.png`;
}
