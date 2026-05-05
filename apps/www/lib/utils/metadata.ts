import { cleanSlug } from "@repo/utilities/helper";
import type { Metadata } from "next";
import type { Locale } from "next-intl";

const SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};
const SOCIAL_SITE_NAME = "Nakafa";
const SOCIAL_TWITTER_ACCOUNT = "@nabilfatih_";

type SocialOpenGraphType = Extract<
  NonNullable<Metadata["openGraph"]>,
  { type: string }
>["type"];

/**
 * Get the Open Graph URL for a given locale and path.
 */
export function getOgUrl(locale: Locale, path: string) {
  const cleanPath = cleanSlug(path.trim());

  if (cleanPath.length === 0) {
    return `/${locale}/og/image.png` as const;
  }

  return `/${locale}/og/${cleanPath}/image.png` as const;
}

/** Builds complete social metadata so nested Open Graph and Twitter fields never fall back to parent defaults. */
export function getSocialMetadata({
  title,
  description,
  locale,
  path,
  image,
  type = "website",
}: {
  title: string;
  description: string;
  locale: Locale;
  path: string;
  image: string;
  type?: SocialOpenGraphType;
}) {
  const metadataImage = {
    url: image,
    alt: title,
    ...SOCIAL_IMAGE_SIZE,
  };

  return {
    openGraph: {
      title,
      description,
      url: path,
      siteName: SOCIAL_SITE_NAME,
      locale,
      type,
      images: [metadataImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [metadataImage],
      creator: SOCIAL_TWITTER_ACCOUNT,
      site: SOCIAL_TWITTER_ACCOUNT,
    },
  };
}
