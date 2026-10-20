import { JsonLd } from "@repo/seo/json-ld";
import { makeCollectionPageNode } from "@repo/seo/json-ld/node";

interface Props {
  datePublished?: string;
  description: string;
  items: { description?: string; name: string; url: string }[];
  name: string;
  url: string;
}

export function CollectionPageJsonLd(props: Props) {
  return <JsonLd jsonLd={makeCollectionPageNode(props)} />;
}
