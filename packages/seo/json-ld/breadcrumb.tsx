import { JsonLd } from "@repo/seo/json-ld";
import { makeBreadcrumbNodes } from "@repo/seo/json-ld/node";
import type { ListItem } from "schema-dts";

interface Props {
  breadcrumbItems: ListItem[];
}

export function BreadcrumbJsonLd({ breadcrumbItems }: Props) {
  const nodes = makeBreadcrumbNodes(breadcrumbItems);
  // Don't render if no breadcrumb items - empty itemListElement is invalid JSON-LD
  if (nodes.length === 0) {
    return null;
  }

  return <JsonLd jsonLd={nodes} />;
}
