import { notFound } from "next/navigation";

/**
 * An address below a school that no page of the school answers yet. It ends as
 * not found inside the school, so the not-found page of the school answers it.
 */
export default function SchoolMissingPage() {
  notFound();
}
