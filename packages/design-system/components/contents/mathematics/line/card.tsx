import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { LineReadouts } from "@repo/design-system/components/contents/mathematics/line/readouts";
import type { ComponentProps } from "react";

/**
 * A line-equation card as a document names it: its scene and controls with the
 * readouts of its lines in the footer, drawn in the reader's locale. Lessons
 * and assessments draw it the same way.
 */
export function LineEquationCard(
  props: Omit<ComponentProps<typeof LineEquation>, "facts">
) {
  return <LineEquation {...props} facts={<LineReadouts />} />;
}
