import { cn } from "@repo/design-system/lib/utils";
import {
  getSearchExcerptParts,
  hasSearchExcerpt,
} from "@/lib/content/search-highlight";

/** Renders a plain Convex search excerpt with safe term highlighting. */
export function SearchExcerpt({
  className,
  excerpt,
  hidden,
  query,
}: {
  className?: string;
  excerpt: string;
  hidden?: boolean;
  query: string;
}) {
  if (hidden || !hasSearchExcerpt(excerpt)) {
    return null;
  }

  return (
    <p className={cn(className)}>
      {getSearchExcerptParts(excerpt, query).map((part) =>
        part.highlighted ? <mark key={part.key}>{part.text}</mark> : part.text
      )}
    </p>
  );
}
