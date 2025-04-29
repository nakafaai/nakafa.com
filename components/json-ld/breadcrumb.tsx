"use client";

import { usePathname } from "@/i18n/navigation";
import { type Locale, useTranslations } from "next-intl";
import { useMemo } from "react";
import type { BreadcrumbList, WithContext } from "schema-dts";
import { JsonLd } from ".";

// Define regex at top level
const NUMERIC_REGEX = /^\d+$/;

// Define mapping of segments to fallbacks
const SEGMENT_FALLBACKS: Record<string, string> = {
  subject: "Subject",
  articles: "Articles",
  "elementary-school": "Elementary School",
  "middle-school": "Middle School",
  "high-school": "High School",
  university: "University",
  politics: "Politics",
};

// Define locales to skip
const SKIP_LOCALES = ["en", "id"];

type BreadcrumbJsonLdProps = {
  id?: string;
  locale: Locale;
};

export function BreadcrumbJsonLd({
  id = "breadcrumb-jsonld",
  locale,
}: BreadcrumbJsonLdProps) {
  const pathname = usePathname();
  const t = useTranslations();

  // Generate breadcrumb items based on the current path
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: No need to refactor
  const breadcrumbItems: BreadcrumbList["itemListElement"] = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const items = [
      {
        "@type": "ListItem" as const,
        "@id": `https://nakafa.com/${locale}#breadcrumb`,
        position: 1,
        name: "Home",
        item: `https://nakafa.com/${locale}`,
      },
    ];

    let currentPath = "";
    for (const segment of segments) {
      currentPath += `/${segment}`;

      // Skip locale segments
      if (SKIP_LOCALES.includes(segment)) {
        continue;
      }

      // Determine segment name
      let name: string;

      // Try to get translated name based on segment type
      try {
        // Handle specific segments with different translation patterns
        if (segment === "subject") {
          name = t("Common.subject");
        } else if (segment === "articles") {
          name = t("Common.articles");
        } else if (segment === "elementary-school") {
          name = t("Subject.elementary-school");
        } else if (segment === "middle-school") {
          name = t("Subject.middle-school");
        } else if (segment === "high-school") {
          name = t("Subject.high-school");
        } else if (segment === "university") {
          name = t("Subject.university");
        } else if (segment === "politics") {
          name = t("Articles.politics");
        } else if (NUMERIC_REGEX.test(segment)) {
          name = t("Subject.grade", { grade: segment });
        } else {
          name = segment.charAt(0).toUpperCase() + segment.slice(1);
        }
      } catch {
        // Use fallback if translation fails
        name =
          SEGMENT_FALLBACKS[segment] ||
          segment.charAt(0).toUpperCase() + segment.slice(1);
      }

      items.push({
        "@type": "ListItem" as const,
        "@id": `https://nakafa.com/${locale}${currentPath}#listItem${items.length + 1}`,
        position: items.length + 1,
        name,
        item: `https://nakafa.com/${locale}${currentPath}`,
      });
    }

    return items;
  }, [pathname, t, locale]);

  const breadcrumbJsonLd: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `https://nakafa.com/${locale}#breadcrumb`,
    url: `https://nakafa.com/${locale}`,
    name: t("Metadata.title"),
    description: t("Metadata.description"),
    potentialAction: [
      {
        "@type": "SearchAction",
        target: `https://nakafa.com/${locale}/search?q={search_term_string}`,
        query: "search_term_string",
      },
    ],
    itemListElement: breadcrumbItems,
  };

  return <JsonLd id={id} jsonLd={breadcrumbJsonLd} />;
}
