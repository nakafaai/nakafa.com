import { MathFontPreload } from "@repo/design-system/components/markdown/fonts";
import {
  MathBlockFrame,
  type MathComponentProps,
} from "@repo/design-system/components/markdown/math";
import { drawMath } from "@repo/design-system/lib/markdown/draw";
import { readMathFonts } from "@repo/design-system/lib/markdown/fonts";
import { FormulaDrawing } from "@/lib/content/renderer/client/base/formula";

/**
 * One formula of a lesson's body. The body is a server component tree, and the
 * page's data repeats every prop of its client elements: a formula given as
 * KaTeX's markup weighed the page twice, about 1.9 MB of a 3.3 MB lesson for its
 * 627 formulas. So the data carries the formula's TeX, `FormulaDrawing` draws it
 * into the page's HTML when the build renders it, and the browser keeps that
 * markup. The faces the formula draws with are read here, from KaTeX's markup,
 * so the page preloads them and a navigation loads them before it shows the page.
 */
function Formula({
  children,
  display,
  errorColor,
  math,
}: MathComponentProps & { readonly display: boolean }) {
  const tex = math ?? children;
  return (
    <>
      <MathFontPreload
        fonts={readMathFonts(drawMath(tex, display, errorColor))}
      />
      <FormulaDrawing display={display} errorColor={errorColor} math={tex} />
    </>
  );
}

/** A lesson's block formula, in the card every block formula takes. */
export function BlockFormula({
  className,
  ...props
}: MathComponentProps & { readonly className?: string }) {
  return (
    <MathBlockFrame className={className}>
      <Formula display={true} {...props} />
    </MathBlockFrame>
  );
}

/** A lesson's inline formula. */
export function InlineFormula(props: MathComponentProps) {
  return <Formula display={false} {...props} />;
}
