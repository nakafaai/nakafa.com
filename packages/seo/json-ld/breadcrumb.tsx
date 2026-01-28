import type { BreadcrumbList, ListItem, WithContext } from "schema-dts";
import { JsonLd } from ".";

interface Props {
  breadcrumbItems: ListItem[];
}

export function BreadcrumbJsonLd({ breadcrumbItems }: Props) {
  const breadcrumbJsonLd: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  return <JsonLd jsonLd={breadcrumbJsonLd} />;
}
