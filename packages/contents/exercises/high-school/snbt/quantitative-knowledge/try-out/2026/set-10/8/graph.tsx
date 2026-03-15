"use client";

import { NumberLine } from "@repo/design-system/components/contents/number-line";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { ComponentProps } from "react";

export function Graph({
  title,
  description,
}: Pick<ComponentProps<typeof NumberLine>, "title" | "description">) {
  return (
    <NumberLine
      description={description}
      max={4}
      min={-5}
      segments={[
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
      ]}
      title={title}
    />
  );
}
