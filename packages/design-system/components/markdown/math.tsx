import { MathFontPreload } from "@repo/design-system/components/markdown/fonts";
import { readMathFonts } from "@repo/design-system/lib/markdown/fonts";
import { cn } from "cn";
import katex from "katex";
import type { HTMLAttributes } from "react";

type MathComponentProps =
  | {
      readonly children?: never;
      readonly errorColor?: string;
      readonly math: string;
    }
  | {
      readonly children: string;
      readonly errorColor?: string;
      readonly math?: never;
    };

type KatexMarkupProps = MathComponentProps & {
  readonly displayMode: boolean;
};

function KatexMarkup({
  children,
  displayMode,
  errorColor = "var(--color-muted-foreground)",
  math,
}: KatexMarkupProps) {
  const html = katex.renderToString(math ?? children, {
    displayMode,
    errorColor,
    throwOnError: false,
    trust: false,
  });
  const fonts = readMathFonts(html);

  if (displayMode) {
    return (
      <>
        <MathFontPreload fonts={fonts} />
        <div
          // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX generates safe HTML while trust remains disabled.
          dangerouslySetInnerHTML={{ __html: html }}
          data-testid="katex"
        />
      </>
    );
  }

  return (
    <>
      <MathFontPreload fonts={fonts} />
      <span
        // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX generates safe HTML while trust remains disabled.
        dangerouslySetInnerHTML={{ __html: html }}
        data-testid="katex"
      />
    </>
  );
}

/**
 * Groups consecutive math blocks into one stacked card.
 *
 * Use this in MDX whenever multiple BlockMath rows are part of the same
 * derivation. The stack keeps one shared outer radius while each row remains
 * horizontally scrollable. Math renders in full with the page: a skipped
 * block would first take a placeholder height and move the text around it.
 */
export function MathContainer({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "my-4 space-y-0 last:mb-0 *:data-math-block:rounded-none *:data-math-block:border-b-0 [&>[data-math-block]:first-child]:rounded-t-xl [&>[data-math-block]:last-child]:rounded-b-xl [&>[data-math-block]:last-child]:border-b",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Renders one block-math card with native horizontal scrolling for wide
 * formulas, as code blocks and inline formulas scroll, under the page's own
 * scrollbar style. A lesson draws dozens of these, so the card is plain markup:
 * no client component hydrates, measures or registers anything for it.
 *
 * MathContainer uses the data-math-block presence marker to style adjacent
 * rows without coupling the stack to implementation-specific class names.
 */
export function BlockMath({
  className,
  ...props
}: MathComponentProps & { className?: string }) {
  // Empty string keeps this as a presence marker instead of data-math-block="true".
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground",
        className
      )}
      data-markdown-ignore=""
      data-math-block=""
    >
      <div
        className="overflow-x-auto overflow-y-hidden px-4"
        data-slot="math-scroll"
      >
        <KatexMarkup displayMode={true} {...props} />
      </div>
    </div>
  );
}

/**
 * Renders one inline KaTeX expression.
 *
 * KaTeX cuts the formula after each relation and binary operator on its outer
 * level, and each piece is one `.katex-base`. The pieces are the boxes of the
 * line, so the text after a formula continues after its last piece. A piece
 * wider than the column scrolls sideways in its own box, which is `inline-flex`
 * because an `inline-block` with `overflow` takes its bottom edge as its
 * baseline. The padding and the negative margin cancel for layout and leave the
 * ink of a root or an underbrace room, which `overflow` would otherwise clip.
 * Its widest is the column plus that padding: a box that may only be as wide as
 * the column would lose the padding's width from its text wherever the column
 * is as wide as the formula, as a table cell is.
 * The strut KaTeX puts in each piece to hold the formula's height and depth is
 * taken out of flow, so a piece keeps the baseline and the line height of the
 * text around it.
 */
export function InlineMath(props: MathComponentProps) {
  return (
    <span
      className="[&_.katex-html>.katex-base]:inline-flex! [&_.katex-html>.katex-base>.katex-strut]:absolute [&_.katex-html>.katex-base]:-m-1 [&_.katex-html>.katex-base]:max-w-[calc(100%+0.5rem)] [&_.katex-html>.katex-base]:items-baseline [&_.katex-html>.katex-base]:overflow-x-auto [&_.katex-html>.katex-base]:overflow-y-hidden [&_.katex-html>.katex-base]:p-1"
      data-markdown-ignore=""
    >
      <KatexMarkup displayMode={false} {...props} />
    </span>
  );
}
