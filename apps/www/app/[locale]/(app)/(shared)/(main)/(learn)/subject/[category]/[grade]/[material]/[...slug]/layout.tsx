import { parseSubjectCategory } from "@repo/contents/_lib/subject/category";
import { parseGrade } from "@repo/contents/_lib/subject/grade";
import { parseMaterial } from "@repo/contents/_lib/subject/route";
import { getSlugPath } from "@repo/contents/_lib/subject/slug";
import { cleanSlug } from "@repo/utilities/helper";
import { Option } from "effect";
import { notFound } from "next/navigation";

import { ContentViewTracker } from "@/components/tracking/tracker";
import { getRuntimeContentViewId } from "@/lib/content/views";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default async function Layout(
  props: LayoutProps<"/[locale]/subject/[category]/[grade]/[material]/[...slug]">
) {
  const { children, params } = props;
  const {
    locale: rawLocale,
    category: rawCategory,
    grade: rawGrade,
    material: rawMaterial,
    slug,
  } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseSubjectCategory(rawCategory);
  const grade = parseGrade(rawGrade);
  const material = parseMaterial(rawMaterial);

  if (
    Option.isNone(category) ||
    Option.isNone(grade) ||
    Option.isNone(material)
  ) {
    notFound();
  }

  const filePath = getSlugPath(
    category.value,
    grade.value,
    material.value,
    slug
  );
  const cleanedSlug = cleanSlug(filePath);
  const contentId = await getRuntimeContentViewId({
    locale,
    route: cleanedSlug,
  });

  if (!contentId) {
    return children;
  }

  return (
    <ContentViewTracker contentId={contentId} locale={locale}>
      {children}
    </ContentViewTracker>
  );
}
