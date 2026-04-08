import { parseSubjectCategory } from "@repo/contents/_lib/subject/category";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getStaticParams } from "@/lib/utils/system";

export function generateStaticParams() {
  return getStaticParams({
    basePath: "subject",
    paramNames: ["category"],
  });
}

export default function Page(props: PageProps<"/[locale]/subject/[category]">) {
  const { params } = props;
  const { locale: rawLocale, category: rawCategory } = use(params);
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseSubjectCategory(rawCategory);

  if (!category) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Return 404 for empty category pages
  // This prevents soft 404s and tells Google these pages don't exist
  // Source: https://developers.google.com/search/docs/crawling-indexing/soft-404s
  notFound();
}
