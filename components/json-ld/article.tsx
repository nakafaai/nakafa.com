import { getAppUrl } from "@/lib/utils";
import type { Article, WithContext } from "schema-dts";
import type { Person } from "schema-dts";
import { JsonLd } from ".";

type Props = {
  id?: string;
  headline: string;
  datePublished: string;
  dateModified?: string;
  author: Person | Person[];
  image?: string;
  description: string;
};

export function ArticleJsonLd({
  id = "article-jsonld",
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

  return <JsonLd id={id} jsonLd={articleJsonLd} />;
}
