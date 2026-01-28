import { getAppUrl } from "@repo/design-system/lib/utils";
import { JsonLd } from "@repo/seo/json-ld";
import { ORGANIZATION } from "@repo/seo/json-ld/constants";
import type { Person } from "schema-dts";

interface ArticleJsonLdProps {
  headline: string;
  datePublished: string;
  dateModified?: string;
  author: Person | Person[];
  image?: string;
  description: string;
  url: string;
}

/**
 * ArticleJsonLd component generates Schema.org Article structured data
 *
 * Uses string URLs for images (not ImageObject) for better validator compatibility
 * per Schema.org and Google Rich Results guidelines.
 *
 * @example
 * ```tsx
 * <ArticleJsonLd
 *   headline="Article Title"
 *   description="Article description"
 *   url="/path/to/article"
 *   datePublished="2024-01-01"
 *   dateModified="2024-01-02"
 *   author={{ "@type": "Person", name: "John Doe" }}
 *   image="/og/article.png"
 * />
 * ```
 */
export function ArticleJsonLd({
  headline,
  datePublished,
  dateModified,
  author,
  image,
  description,
  url,
}: ArticleJsonLdProps) {
  const appUrl = getAppUrl();

  // Build absolute URL
  const absoluteUrl = url.startsWith("http") ? url : `${appUrl}${url}`;

  // Build absolute image URL if provided
  // Using string URL format for better Schema.org validator compatibility
  let absoluteImageUrl: string | undefined;
  if (image) {
    absoluteImageUrl = image.startsWith("http") ? image : `${appUrl}${image}`;
  }

  // Ensure authors are properly formatted
  const authors = Array.isArray(author) ? author : [author];

  // Build Article structured data
  const article = {
    "@context": "https://schema.org" as const,
    "@type": "Article" as const,
    name: headline,
    headline,
    url: absoluteUrl,
    mainEntityOfPage: {
      "@type": "WebPage" as const,
      "@id": absoluteUrl,
    },
    datePublished,
    dateModified: dateModified || datePublished,
    author: authors,
    image: absoluteImageUrl ? [absoluteImageUrl] : undefined,
    description,
    publisher: ORGANIZATION,
  };

  return <JsonLd jsonLd={article} />;
}
