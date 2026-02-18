import type { CollectionPage, CreativeWork, WithContext } from "schema-dts";
import { JsonLd } from ".";
import { ORGANIZATION } from "./constants";

interface Props {
  datePublished?: string;
  description: string;
  items: Pick<CreativeWork, "name" | "url" | "description">[];
  name: string;
  url: string;
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
