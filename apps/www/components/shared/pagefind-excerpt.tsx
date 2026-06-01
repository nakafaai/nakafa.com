import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

const PAGEFIND_MARK_TAG_PATTERN = /(<mark>|<\/mark>)/g;

/**
 * Converts Pagefind's limited `<mark>` excerpt markup into React nodes.
 */
function PagefindExcerptContent({ excerpt }: { excerpt: string }) {
  const nodes: ReactNode[] = [];
  let isMarked = false;

  for (const part of excerpt.split(PAGEFIND_MARK_TAG_PATTERN)) {
    if (part === "<mark>") {
      isMarked = true;
      continue;
    }

    if (part === "</mark>") {
      isMarked = false;
      continue;
    }

    if (!part) {
      continue;
    }

    nodes.push(isMarked ? <mark key={nodes.length}>{part}</mark> : part);
  }

  return nodes;
}

/** Renders Pagefind excerpts without injecting arbitrary HTML. */
export function PagefindExcerpt({
  className,
  excerpt,
  hidden,
}: {
  className?: string;
  excerpt: string;
  hidden?: boolean;
}) {
  return (
    <p className={cn(className, hidden && "hidden")}>
      <PagefindExcerptContent excerpt={excerpt} />
    </p>
  );
}
