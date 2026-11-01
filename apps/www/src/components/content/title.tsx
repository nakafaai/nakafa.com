import { cn } from "cn";
import type { ReactNode } from "react";
import { pageRowVariants } from "@/components/shared/content/width";

/** Gives lessons and articles one left-aligned reading title, an optional summary, and what stands under them. */
export function ContentTitle({
  children,
  title,
  description,
}: {
  children?: ReactNode;
  title: string;
  description?: string | undefined;
}) {
  return (
    <header className="relative py-20">
      <div className={cn(pageRowVariants(), "space-y-6")}>
        <h1 className="text-4xl leading-tight font-normal tracking-tight text-balance wrap-anywhere hyphens-auto">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground max-w-2xl text-pretty">
            {description}
          </p>
        )}
        {children}
      </div>
    </header>
  );
}
