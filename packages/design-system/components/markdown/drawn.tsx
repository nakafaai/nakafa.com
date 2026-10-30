/**
 * Inline math that KaTeX has drawn, as its markup: `InlineMath` draws through it,
 * and so does a part that shows math drawn ahead of time, such as the names of a
 * scene's axes, which then loads no math runtime.
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
export function DrawnInlineMath({ html }: { html: string }) {
  return (
    <span
      className="[&_.katex-html>.katex-base]:inline-flex! [&_.katex-html>.katex-base>.katex-strut]:absolute [&_.katex-html>.katex-base]:-m-1 [&_.katex-html>.katex-base]:max-w-[calc(100%+0.5rem)] [&_.katex-html>.katex-base]:items-baseline [&_.katex-html>.katex-base]:overflow-x-auto [&_.katex-html>.katex-base]:overflow-y-hidden [&_.katex-html>.katex-base]:p-1"
      data-markdown-ignore=""
    >
      <span
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the markup is KaTeX's own, drawn with trust disabled.
        dangerouslySetInnerHTML={{ __html: html }}
        data-testid="katex"
      />
    </span>
  );
}
