import { cn } from "cn";
import { Array as Arr } from "effect";
import {
  getSearchExcerptParts,
  hasSearchExcerpt,
} from "@/lib/search/highlight";

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
      {Arr.map(getSearchExcerptParts(excerpt, query), (part) =>
        part.highlighted ? <mark key={part.key}>{part.text}</mark> : part.text
      )}
    </p>
  );
}
