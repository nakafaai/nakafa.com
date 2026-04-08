import { getSlugPath } from "@repo/contents/_lib/subject/slug";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";
import { routing } from "@repo/internationalization/src/routing";
import { cleanSlug } from "@repo/utilities/helper";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ContentViewTracker } from "@/components/tracking/content-view-tracker";

type Props =
  LayoutProps<"/[locale]/subject/[category]/[grade]/[material]/[...slug]"> & {
    params: Promise<{
      category: SubjectCategory;
      grade: Grade;
      locale: string;
      material: Material;
      slug: string[];
    }>;
  };

export default function Layout(props: Props) {
  const { children, params } = props;
  const { locale, category, grade, material, slug } = use(params);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

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
