import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { getStaticParams } from "@/lib/utils/system";

interface Props {
  params: Promise<{ locale: Locale }>;
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "exercises",
    paramNames: ["category"],
  });
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  // Return 404 for empty exercise category pages
  // This prevents soft 404s and tells Google these pages don't exist
  // Source: https://developers.google.com/search/docs/crawling-indexing/soft-404s
  notFound();
}
