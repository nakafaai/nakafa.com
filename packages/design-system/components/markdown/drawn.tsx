import { mathInlineVariants } from "@repo/design-system/lib/prose";

/**
 * Inline math that KaTeX has drawn, as its markup, in the box every inline
 * formula takes (`mathInlineVariants`): `InlineMath` draws through it, and so
 * does a part that shows math drawn ahead of time, such as the names of a
 * scene's axes, which then loads no math runtime.
 */
export function DrawnInlineMath({ html }: { html: string }) {
  return (
    <span className={mathInlineVariants()} data-markdown-ignore="">
      <span
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the markup is KaTeX's own, drawn with trust disabled.
        dangerouslySetInnerHTML={{ __html: html }}
        data-testid="katex"
      />
    </span>
  );
}
