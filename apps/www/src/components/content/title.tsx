import { cn } from "cn";
import type { ReactNode } from "react";
import { pageRowVariants } from "@/components/shared/page/width";

/** Gives a lesson one left-aligned reading title and what stands under it. */
export function ContentTitle({
  children,
  title,
}: {
  children?: ReactNode;
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

/**
 * What opens an article whose path in its header names it: its byline, in the
 * reading column, over the article's first words.
 */
export function ContentLead({ children }: { children: ReactNode }) {
  return <div className={cn(pageRowVariants(), "pt-8 pb-10")}>{children}</div>;
}
