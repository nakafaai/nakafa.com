import { parseExercisesCategory } from "@repo/contents/_lib/exercises/category";
import { parseExercisesMaterial } from "@repo/contents/_lib/exercises/material";
import { getSlugPath } from "@repo/contents/_lib/exercises/slug";
import { parseExercisesType } from "@repo/contents/_lib/exercises/type";
import { cleanSlug } from "@repo/utilities/helper";
import { notFound } from "next/navigation";

import { use } from "react";
import { ContentViewTracker } from "@/components/tracking/content-view-tracker";
import { AttemptContextProvider } from "@/lib/context/use-attempt";
import { ExerciseContextProvider } from "@/lib/context/use-exercise";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { isNumber } from "@/lib/utils/number";

export default function Layout(
  props: LayoutProps<"/[locale]/exercises/[category]/[type]/[material]/[...slug]">
) {
  const { children, params } = props;
  const {
    locale: rawLocale,
    category: rawCategory,
    type: rawType,
    material: rawMaterial,
    slug,
  } = use(params);
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseExercisesCategory(rawCategory);
  const type = parseExercisesType(rawType);
  const material = parseExercisesMaterial(rawMaterial);

  if (!(category && type && material)) {
    notFound();
  }

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
