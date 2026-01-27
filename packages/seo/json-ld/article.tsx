import { getAppUrl } from "@repo/design-system/lib/utils";
import { JsonLd } from "@repo/seo/json-ld";
import { ORGANIZATION } from "@repo/seo/json-ld/constants";
import type { ImageObject, Person } from "schema-dts";

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

  // Build image object if image is provided
  let imageObject: ImageObject | undefined;
  if (image) {
    const imageUrl = image.startsWith("http") ? image : `${appUrl}${image}`;
    imageObject = {
      "@type": "ImageObject",
      url: imageUrl,
    };
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
    image: imageObject ? [imageObject] : undefined,
    description,
    publisher: ORGANIZATION,
  };

  return <JsonLd jsonLd={article} />;
}
