import { readCanonicalSpelling } from "@repo/internationalization/src/pathnames";
import { cleanSlug } from "@repo/utilities/slug";
import { Option, Schema } from "effect";
import type { Locale } from "use-intl";

export const SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};
export const SOCIAL_SITE_NAME = "Nakafa";
export const SOCIAL_TWITTER_ACCOUNT = "@nabilfatih_";

/** The Open Graph types that a page declares. */
export const SocialOpenGraphType = Schema.Literals([
  "article",
  "book",
  "website",
]);

type SocialOpenGraphType = typeof SocialOpenGraphType.Type;

/**
 * The sections that own one social image each. Every page of a section shares its
 * section's image, which the build writes once per locale. A section without
 * published copy in every locale has no image, so its pages share the home image.
 */
export const OG_COLLECTIONS = ["articles", "curriculum"] as const;
type OgCollection = (typeof OG_COLLECTIONS)[number];

/**
 * Names the section of a locale path, or none for a page that has no section image
 * of its own. The curricula section is spelled differently in each locale, and the
 * image of every spelling is the one `curriculum` image.
 */
function readOgCollection(locale: Locale, cleanPath: string) {
  const [section] = cleanPath.split("/");
  if (section === "articles") {
    return Option.some<OgCollection>("articles");
  }
  return Option.flatMap(Option.fromNullishOr(section), (spelling) =>
    Option.match(readCanonicalSpelling(locale, spelling), {
      onNone: () => Option.none<OgCollection>(),
      onSome: (canonical) =>
        canonical === "curricula" ? Option.some("curriculum") : Option.none(),
    })
  );
}

/**
 * Get the Open Graph URL for a given locale and path. A page in a section answers
 * the image of that section, and every other page answers the home image.
 */
export function getOgUrl(locale: Locale, path: string) {
  const cleanPath = cleanSlug(path.trim());
  const collection = readOgCollection(locale, cleanPath);

  if (Option.isNone(collection)) {
    return `/${locale}/og/image.png` as const;
  }

  return `/${locale}/og/${collection.value}/image.png` as const;
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
