import { notFound } from "next/navigation";

import { getStaticParams } from "@/lib/utils/system";

export function generateStaticParams() {
  return getStaticParams({
    basePath: "subject",
    paramNames: ["category"],
  });
}

export default function Page() {
  // Return 404 for empty category pages
  // This prevents soft 404s and tells Google these pages don't exist
  // Source: https://developers.google.com/search/docs/crawling-indexing/soft-404s
  notFound();
}
