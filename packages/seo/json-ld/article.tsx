import { getAppUrl } from "@repo/design-system/lib/utils";
import { JsonLd } from "@repo/seo/json-ld";
import { ORGANIZATION } from "@repo/seo/json-ld/constants";
import {
  type Article,
  ArticleSchema,
  type ImageObject,
  ImageObjectSchema,
  type Person,
  PersonSchema,
} from "@repo/seo/json-ld/schemas";

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
    imageObject = ImageObjectSchema.parse({
      "@type": "ImageObject",
      url: imageUrl,
    });
  }

  // Ensure authors are properly formatted
  const authors = Array.isArray(author) ? author : [author];
  const formattedAuthors = authors.map((a) =>
    PersonSchema.parse({
      "@type": "Person",
      name: a.name,
      url: a.url,
    })
  );

  // Build and validate Article structured data
  const article: Article = ArticleSchema.parse({
    "@context": "https://schema.org",
    "@type": "Article",
    name: headline,
    headline,
    url: absoluteUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl,
    },
    datePublished,
    dateModified: dateModified || datePublished,
    author: formattedAuthors,
    image: imageObject ? [imageObject] : undefined,
    description,
    publisher: ORGANIZATION,
  });

  return <JsonLd jsonLd={article} />;
}
