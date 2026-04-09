import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Page(props: PageProps<"/[locale]/articles">) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  // Enable static rendering
  setRequestLocale(locale);

  // Return 404 for empty articles index page
  // This prevents soft 404s and tells Google this page doesn't exist
  // Source: https://developers.google.com/search/docs/crawling-indexing/soft-404s
  notFound();
}
