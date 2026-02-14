import { getSlugPath } from "@repo/contents/_lib/subject/slug";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";
import { cleanSlug } from "@repo/utilities/helper";
import type { Locale } from "next-intl";
import { use } from "react";
import { ContentViewTracker } from "@/components/tracking/content-view-tracker";

interface Params {
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
  material: Material;
  slug: string[];
}

interface Props {
  children: React.ReactNode;
  params: Promise<Params>;
}

export default function Layout({ children, params }: Props) {
  const { locale, category, grade, material, slug } = use(params);
  const filePath = getSlugPath(category, grade, material, slug);
  const cleanedSlug = cleanSlug(filePath);

  return (
    <ContentViewTracker
      contentType="subject"
      locale={locale}
      slug={cleanedSlug}
    >
      {children}
    </ContentViewTracker>
  );
}
