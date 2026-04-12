import { parseSubjectCategory } from "@repo/contents/_lib/subject/category";
import { notFound } from "next/navigation";

import { use } from "react";
import { getStaticParams } from "@/lib/utils/system";

export function generateStaticParams() {
  return getStaticParams({
    basePath: "subject",
    paramNames: ["category"],
  });
}

export default function Page(props: PageProps<"/[locale]/subject/[category]">) {
  const { params } = props;
  const { category: rawCategory } = use(params);
  const category = parseSubjectCategory(rawCategory);

  if (!category) {
    notFound();
  }

  // Return 404 for empty category pages
  // This prevents soft 404s and tells Google these pages don't exist
  // Source: https://developers.google.com/search/docs/crawling-indexing/soft-404s
  notFound();
}
