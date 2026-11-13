import { closeMathCopyToSnippets } from "@repo/design-system/lib/markdown/snippet";
import { mathInlineVariants } from "@repo/design-system/lib/prose";

/**
 * Inline math that KaTeX has drawn, as its markup, in the box every inline
 * formula takes (`mathInlineVariants`): `InlineMath` draws through it, and so
 * does a part that shows math drawn ahead of time, such as the names of a
 * scene's axes, which then loads no math runtime. The formula's MathML copy
 * stays out of search snippets (`closeMathCopyToSnippets`).
 */
export function DrawnInlineMath({ html }: { html: string }) {
  return (
    <span className={mathInlineVariants()} data-markdown-ignore="">
      <span
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the markup is KaTeX's own, drawn with trust disabled.
        dangerouslySetInnerHTML={{ __html: closeMathCopyToSnippets(html) }}
        data-testid="katex"
        suppressHydrationWarning
      />
    </span>
  );
}

/**
 * Display math that KaTeX has drawn, as its markup: `BlockMath` draws through it
 * inside its card. The formula's MathML copy stays out of search snippets.
 *
 * Both drawings take empty markup to keep the formula the server drew: React
 * never sets the markup of an element it hydrates, so a lesson's formulas keep
 * their HTML while the page's data carries only their TeX.
 */
export function DrawnBlockMath({ html }: { html: string }) {
  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the markup is KaTeX's own, drawn with trust disabled.
      dangerouslySetInnerHTML={{ __html: closeMathCopyToSnippets(html) }}
      data-testid="katex"
      suppressHydrationWarning
    />
  );
}
