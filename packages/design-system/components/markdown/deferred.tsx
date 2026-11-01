import { lazy } from "@repo/design-system/lib/lazy";
import {
  learnerParagraphVariants,
  learnerTextVariants,
} from "@repo/design-system/lib/prose";
import { cn } from "cn";
import { Array as Arr, String as Str } from "effect";
import { Suspense } from "react";

/** The Markdown pipeline of learner text, loaded when a client draws the first text. */
const LearnerMarkdown = lazy(() =>
  import("@repo/design-system/components/markdown/learner").then((module) => ({
    default: module.LearnerText,
  }))
);

/** A blank line ends a paragraph, as it does in Markdown. */
const PARAGRAPH_BREAK = /\n\s*\n/u;

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
        <PlainLearnerText className={className}>{children}</PlainLearnerText>
      }
    >
      <LearnerMarkdown className={className}>{children}</LearnerMarkdown>
    </Suspense>
  );
}

/**
 * The text as the learner wrote it, in the boxes its Markdown draws a paragraph
 * in, so a text of paragraphs stays exactly where it stands when the pipeline
 * arrives.
 */
function PlainLearnerText({
  children,
  className,
}: {
  readonly children: string;
  readonly className?: string | undefined;
}) {
  return (
    <div className={cn(learnerTextVariants(), className)}>
      {Arr.map(readParagraphs(children), ({ start, text }) => (
        <p
          className={learnerParagraphVariants({
            className: "whitespace-pre-wrap",
          })}
          dir="auto"
          key={start}
        >
          {text}
        </p>
      ))}
    </div>
  );
}

/** The paragraphs of a text, each with the place it starts, which no other paragraph shares. */
function readParagraphs(text: string) {
  const [, paragraphs] = Arr.mapAccum(
    Str.split(text, PARAGRAPH_BREAK),
    0,
    (start, paragraph) => [
      start + paragraph.length + 1,
      { start, text: paragraph },
    ]
  );
  return paragraphs;
}
