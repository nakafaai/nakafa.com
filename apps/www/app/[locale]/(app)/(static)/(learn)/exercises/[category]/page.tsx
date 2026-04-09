import { parseExercisesCategory } from "@repo/contents/_lib/exercises/category";
import { notFound } from "next/navigation";

import { use } from "react";
import { getStaticParams } from "@/lib/utils/system";

export function generateStaticParams() {
  return getStaticParams({
    basePath: "exercises",
    paramNames: ["category"],
  });
}

export default function Page(
  props: PageProps<"/[locale]/exercises/[category]">
) {
  const { params } = props;
  const { category: rawCategory } = use(params);
  const category = parseExercisesCategory(rawCategory);

  if (!category) {
    notFound();
  }

  // Enable static rendering

  // Return 404 for empty exercise category pages
  // This prevents soft 404s and tells Google these pages don't exist
  // Source: https://developers.google.com/search/docs/crawling-indexing/soft-404s
  notFound();
}
