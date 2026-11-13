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
  title: string;
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
