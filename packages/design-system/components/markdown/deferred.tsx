import { cn } from "cn";
import { lazy, Suspense } from "react";

/** The Markdown pipeline of learner text, loaded when a client draws the first text. */
const LearnerMarkdown = lazy(() =>
  import("@repo/design-system/components/markdown/learner").then((module) => ({
    default: module.LearnerText,
  }))
);

/**
 * Text a learner wrote, drawn by a client component. The Markdown pipeline
 * loads once the first text is drawn, so it stays out of a page's first
 * JavaScript, and until it arrives the text shows as the learner wrote it, with
 * its line breaks. A server component draws `LearnerText` itself, which sends
 * no JavaScript at all.
 */
export function DeferredLearnerText({
  children,
  className,
}: {
  readonly children: string;
  readonly className?: string | undefined;
}) {
  return (
    <Suspense
      fallback={
        <div
          className={cn("wrap-anywhere whitespace-pre-wrap", className)}
          dir="auto"
        >
          {children}
        </div>
      }
    >
      <LearnerMarkdown className={className}>{children}</LearnerMarkdown>
    </Suspense>
  );
}
