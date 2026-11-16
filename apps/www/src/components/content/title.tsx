import { cn } from "cn";
import type { ReactNode } from "react";
import { pageRowVariants } from "@/components/shared/page/width";

/**
 * Opens every reading page, a lesson or an article, under its header: the page's one visible heading, left-aligned
 * in the reading column, and what stands under it, such as the byline. The header above holds only the path to the
 * page's parent and the reading controls, so a reading page names itself here once.
 */
export function ContentTitle({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="relative py-20">
      <div className={cn(pageRowVariants(), "space-y-6")}>
        <h1 className="text-4xl leading-tight font-normal tracking-tight text-balance wrap-anywhere hyphens-auto">
          {title}
        </h1>
        {children}
      </div>
    </header>
  );
}

/**
 * The lead line of a reading page, under its heading and before its byline: the
 * page's own description, which says in one sentence what the page teaches, as a
 * reader and a search engine meet it first. Two lines at most keep the header to its
 * title and one line under it; the whole sentence stays in the page.
 */
export function ContentLead({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground line-clamp-2 text-lg text-pretty">
      {children}
    </p>
  );
}
