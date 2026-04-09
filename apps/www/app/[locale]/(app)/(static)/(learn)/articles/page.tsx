import { notFound } from "next/navigation";

export default function Page() {
  // Return 404 for empty articles index page
  // This prevents soft 404s and tells Google this page doesn't exist
  // Source: https://developers.google.com/search/docs/crawling-indexing/soft-404s
  notFound();
}
