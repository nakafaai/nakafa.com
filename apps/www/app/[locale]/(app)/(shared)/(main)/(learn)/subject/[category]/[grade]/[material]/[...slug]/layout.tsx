import { parseSubjectCategory } from "@repo/contents/_lib/subject/category";
import { parseGrade } from "@repo/contents/_lib/subject/grade";
import { parseMaterial } from "@repo/contents/_lib/subject/material";
import { getSlugPath } from "@repo/contents/_lib/subject/slug";
import { cleanSlug } from "@repo/utilities/helper";
import { notFound } from "next/navigation";

import { use } from "react";
import { ContentViewTracker } from "@/components/tracking/content-view-tracker";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Layout(
  props: LayoutProps<"/[locale]/subject/[category]/[grade]/[material]/[...slug]">
) {
  const { children, params } = props;
  const {
    locale: rawLocale,
    category: rawCategory,
    grade: rawGrade,
    material: rawMaterial,
    slug,
  } = use(params);
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseSubjectCategory(rawCategory);
  const grade = parseGrade(rawGrade);
  const material = parseMaterial(rawMaterial);

  if (!(category && grade && material)) {
    notFound();
  }

  const filePath = getSlugPath(category, grade, material, slug);
  const cleanedSlug = cleanSlug(filePath);

  return (
    <ContentViewTracker
      contentView={{ type: "subject", slug: cleanedSlug }}
      locale={locale}
    >
      {children}
    </ContentViewTracker>
  );
}
