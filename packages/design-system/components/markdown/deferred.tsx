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

/** A blank line, where Markdown starts a new block. */
const BLANK_LINE = /\n[ \t]*\n/u;

/** The blocks of a text, each with where it starts, which tells two equal blocks apart. */
function readBlocks(text: string) {
  const [, blocks] = Arr.mapAccum(
    Str.split(BLANK_LINE)(text),
    0,
    (start, block) => [start + block.length + 1, { start, text: block }]
  );
  return blocks;
}

/** One block of the text as the learner wrote it, sized as `LearnerText` sizes a paragraph. */
function PlainBlock({ children }: { readonly children: string }) {
  return (
    <p
      className={learnerParagraphVariants({
        className: "whitespace-pre-wrap",
      })}
      dir="auto"
    >
      {children}
    </p>
  );
}

/**
 * Text a learner wrote, drawn by a client component. The Markdown pipeline
 * loads once the first text is drawn, so it stays out of a page's first
 * JavaScript, and until it arrives the text shows as the learner wrote it, with
 * its line breaks, in the blocks and the line height that Markdown will draw, so
 * the rows under it stay where they are. A server component draws `LearnerText`
 * itself, which sends no JavaScript at all.
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
        <div className={cn(learnerTextVariants(), className)}>
          {Arr.map(readBlocks(children), ({ start, text }) => (
            <PlainBlock key={start}>{text}</PlainBlock>
          ))}
        </div>
      }
    >
      <LearnerMarkdown className={className}>{children}</LearnerMarkdown>
    </Suspense>
  );
}
