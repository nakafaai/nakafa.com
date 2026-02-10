import type { BreadcrumbList, ListItem, WithContext } from "schema-dts";
import { JsonLd } from ".";

interface Props {
  breadcrumbItems: ListItem[];
}

export function BreadcrumbJsonLd({ breadcrumbItems }: Props) {
  // Don't render if no breadcrumb items - empty itemListElement is invalid JSON-LD
  if (breadcrumbItems.length === 0) {
    return null;
  }

  const breadcrumbJsonLd: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  return <JsonLd jsonLd={breadcrumbJsonLd} />;
}
