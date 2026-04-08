import { getSlugPath } from "@repo/contents/_lib/exercises/slug";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { routing } from "@repo/internationalization/src/routing";
import { cleanSlug } from "@repo/utilities/helper";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ContentViewTracker } from "@/components/tracking/content-view-tracker";
import { AttemptContextProvider } from "@/lib/context/use-attempt";
import { ExerciseContextProvider } from "@/lib/context/use-exercise";
import { isNumber } from "@/lib/utils/number";

type Props =
  LayoutProps<"/[locale]/exercises/[category]/[type]/[material]/[...slug]"> & {
    params: Promise<{
      category: ExercisesCategory;
      locale: string;
      material: ExercisesMaterial;
      slug: string[];
      type: ExercisesType;
    }>;
  };

export default function Layout(props: Props) {
  const { children, params } = props;
  const { locale, category, type, material, slug } = use(params);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const lastSlug = slug.at(-1);
  const baseSlug = lastSlug && isNumber(lastSlug) ? slug.slice(0, -1) : slug;

  const filePath = getSlugPath(category, type, material, baseSlug);

  const cleanedSlug = cleanSlug(filePath);

  return (
    <ContentViewTracker
      contentView={{ type: "exercise", slug: cleanedSlug }}
      locale={locale}
    >
      <ExerciseContextProvider key={cleanedSlug} slug={cleanedSlug}>
        <AttemptContextProvider locale={locale} slug={cleanedSlug}>
          {children}
        </AttemptContextProvider>
      </ExerciseContextProvider>
    </ContentViewTracker>
  );
}
