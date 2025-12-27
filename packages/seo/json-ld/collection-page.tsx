import type { CollectionPage, WithContext } from "schema-dts";
import { JsonLd } from ".";
import { ORGANIZATION } from "./constants";

interface CollectionItem {
  url: string;
  name: string;
  description?: string;
}

interface Props {
  name: string;
  description: string;
  url: string;
  items: CollectionItem[];
  datePublished?: string;
  numberOfItems?: number;
}

export function CollectionPageJsonLd({
  name,
  description,
  url,
  items,
  datePublished,
}: Props) {
  const collectionPageJsonLd: WithContext<CollectionPage> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    publisher: ORGANIZATION,
    maintainer: ORGANIZATION,
    hasPart: items.map((item) => ({
      "@type": "WebPage",
      name: item.name,
      url: item.url,
      description: item.description,
    })),
    ...(datePublished && { datePublished }),
  };

  return <JsonLd jsonLd={collectionPageJsonLd} />;
}
