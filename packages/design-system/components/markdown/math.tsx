import { MathFontPreload } from "@repo/design-system/components/markdown/fonts";
import {
  ScrollArea,
  ScrollBar,
} from "@repo/design-system/components/ui/scroll-area";
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
 * Renders one KaTeX block without the surrounding card shell.
 */

export function BlockMathKatex(props: MathComponentProps) {
  return (
    <div data-markdown-ignore="">
      <KatexMarkup displayMode={true} {...props} />
    </div>
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
 * formulas.
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
      <ScrollArea className="grid">
        <div className="px-4">
          <KatexMarkup displayMode={true} {...props} />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

/**
 * Renders one inline KaTeX expression.
 */
export function InlineMath(props: MathComponentProps) {
  return (
    <span data-markdown-ignore="">
      <KatexMarkup displayMode={false} {...props} />
    </span>
  );
}
