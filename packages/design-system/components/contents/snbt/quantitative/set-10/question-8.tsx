import {
  type NumberLine,
  NumberLineBody,
  NumberLineProvider,
} from "@repo/design-system/components/contents/mathematics/number-line";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  VisualCard,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import type { ComponentProps } from "react";

/** Renders the number-line graph for SNBT set 10 question 8. */
export function Graph({
  title,
  description,
}: Pick<ComponentProps<typeof NumberLine>, "title" | "description">) {
  const config = {
    max: 4,
    min: -5,
    segments: [
      {
        start: Number.NEGATIVE_INFINITY,
        end: -3,
        endInclusive: false,
        shaded: true,
        label: <InlineMath math="+++" />,
      },
      {
        start: -3,
        end: 2,
        startInclusive: false,
        endInclusive: false,
        shaded: false,
        label: <InlineMath math="---" />,
        startLabel: <InlineMath math="-3" />,
        endLabel: <InlineMath math="2" />,
      },
      {
        start: 2,
        end: Number.POSITIVE_INFINITY,
        startInclusive: false,
        shaded: true,
        label: <InlineMath math="+++" />,
      },
    ],
  };

  return (
    <NumberLineProvider config={config}>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <NumberLineBody />
      </VisualCard>
    </NumberLineProvider>
  );
}
