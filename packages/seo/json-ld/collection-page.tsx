import { JsonLd } from "@repo/seo/json-ld";
import { makeCollectionPageNode } from "@repo/seo/json-ld/node";
import type { CreativeWork } from "schema-dts";

interface Props {
  datePublished?: string;
  description: string;
  items: Pick<CreativeWork, "name" | "url" | "description">[];
  name: string;
  url: string;
}

export function CollectionPageJsonLd(props: Props) {
  return <JsonLd jsonLd={makeCollectionPageNode(props)} />;
}
