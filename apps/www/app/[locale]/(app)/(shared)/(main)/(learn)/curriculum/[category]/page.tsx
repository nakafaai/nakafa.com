import { listCurriculumCategoryParams } from "@repo/contents/_types/curriculum/routes";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return listCurriculumCategoryParams();
}

export default function Page() {
  // Return 404 for empty category pages
  // This prevents soft 404s and tells Google these pages don't exist
  // Source: https://developers.google.com/search/docs/crawling-indexing/soft-404s
  notFound();
}
