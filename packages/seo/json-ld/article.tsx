import { getAppUrl } from "@repo/design-system/lib/utils";
import { JsonLd } from "@repo/seo/json-ld";
import type { Article, Person, WithContext } from "schema-dts";

type Props = {
  headline: string;
  datePublished: string;
  dateModified?: string;
  author: Person | Person[];
  image?: string;
  description: string;
};

export function ArticleJsonLd({
  headline,
  datePublished,
  dateModified,
  author,
  image,
  description,
}: Props) {
  // add app url if image is relative
  if (image?.startsWith("/")) {
    image = `${getAppUrl()}${image}`;
  }

  const articleJsonLd: WithContext<Article> = {
    "@context": "https://schema.org",
    "@type": "Article",
    name: headline,
    headline,
    datePublished,
    dateModified: dateModified || datePublished,
    author: Array.isArray(author) ? author : [author],
    image: image ? [image] : undefined,
    description,
    publisher: {
      "@type": "Organization",
      name: "PT. Nakafa Tekno Kreatif",
      logo: "https://nakafa.com/logo.svg",
      url: "https://nakafa.com",
    },
    maintainer: {
      "@type": "Organization",
      name: "PT. Nakafa Tekno Kreatif",
      logo: "https://nakafa.com/logo.svg",
      url: "https://nakafa.com",
    },
  };

  return <JsonLd jsonLd={articleJsonLd} />;
}
