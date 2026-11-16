import { MathFontPreload } from "@repo/design-system/components/markdown/fonts";
import {
  MathBlockFrame,
  type MathComponentProps,
} from "@repo/design-system/components/markdown/math";
import { drawMath } from "@repo/design-system/lib/markdown/draw";
import { readMathFonts } from "@repo/design-system/lib/markdown/fonts";
import { FormulaDrawing } from "@/lib/content/renderer/client/base/formula";
import { IN_PROP } from "@/lib/content/renderer/prop";

/**
 * One formula of a lesson's body. The body is a server component tree, and the
 * page's data repeats every prop of its client elements: a formula given as
 * KaTeX's markup weighed the page twice, about 1.9 MB of a 3.3 MB lesson for its
 * 627 formulas. So the data carries the formula's TeX, `FormulaDrawing` draws it
 * into the page's HTML when the build renders it, and the browser keeps that
 * markup. The faces the formula draws with are read here, from KaTeX's markup,
 * so the page preloads them and a navigation loads them before it shows the page.
 *
 * A formula inside another renderer's prop, such as a scene's label, can mount
 * where the server never renders it: in a canvas overlay, which only the browser
 * draws. It carries the markup drawn here, so the browser shows it without KaTeX
 * (ADR 0039 D13). Such a formula is a few characters, and the body's formulas
 * still carry only their TeX.
 */
function Formula({
  children,
  display,
  inProp,
  math,
}: MathComponentProps & {
  readonly display: boolean;
  readonly inProp: boolean;
}) {
  const tex = math ?? children;
  const html = drawMath(tex, display);
  return (
    <>
      <MathFontPreload fonts={readMathFonts(html)} />
      {inProp ? (
        <FormulaDrawing display={display} markup={html} math={tex} />
      ) : (
        <FormulaDrawing display={display} math={tex} />
      )}
    </>
  );
}

/** A lesson's block formula, in the card every block formula takes; inside another renderer's prop it carries its markup. */
export const BlockFormula = Object.assign(
  ({
    className,
    ...props
  }: MathComponentProps & { readonly className?: string }) => (
    <MathBlockFrame className={className}>
      <Formula display={true} inProp={false} {...props} />
    </MathBlockFrame>
  ),
  {
    [IN_PROP]: ({
      className,
      ...props
    }: MathComponentProps & { readonly className?: string }) => (
      <MathBlockFrame className={className}>
        <Formula display={true} inProp={true} {...props} />
      </MathBlockFrame>
    ),
  }
);

/** A lesson's inline formula; inside another renderer's prop it carries its markup. */
export const InlineFormula = Object.assign(
  (props: MathComponentProps) => (
    <Formula display={false} inProp={false} {...props} />
  ),
  {
    [IN_PROP]: (props: MathComponentProps) => (
      <Formula display={false} inProp={true} {...props} />
    ),
  }
);
