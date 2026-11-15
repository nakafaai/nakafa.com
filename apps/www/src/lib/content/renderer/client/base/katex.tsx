import {
  DrawnBlockMath,
  DrawnInlineMath,
} from "@repo/design-system/components/markdown/drawn";
import { drawMath } from "@repo/design-system/lib/markdown/draw";

/** One formula drawn with KaTeX, where no server markup stands for it. */
export function KatexFormula({
  display,
  math,
}: {
  readonly display: boolean;
  readonly math: string;
}) {
  const html = drawMath(math, display);
  return display ? (
    <DrawnBlockMath html={html} />
  ) : (
    <DrawnInlineMath html={html} />
  );
}
