import {
  DrawnBlockMath,
  DrawnInlineMath,
} from "@repo/design-system/components/markdown/drawn";
import { drawMath } from "@repo/design-system/lib/markdown/draw";

/** One formula drawn with KaTeX, where no server markup stands for it. */
export function KatexFormula({
  display,
  errorColor,
  math,
}: {
  readonly display: boolean;
  readonly errorColor?: string | undefined;
  readonly math: string;
}) {
  const html = drawMath(math, display, errorColor);
  return display ? (
    <DrawnBlockMath html={html} />
  ) : (
    <DrawnInlineMath html={html} />
  );
}
