"use client";

import { useTriangle } from "@repo/design-system/components/contents/mathematics/triangle/context";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { TRIANGLE_SIDES } from "@repo/design-system/components/three/triangle/sides";
import { VisualCardFacts } from "@repo/design-system/components/visual/card";
import {
  VisualFact,
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { getCos, getRadians, getSin, getTan } from "@repo/math/angles";
import { Array as Arr } from "effect";
import { useFormatter, useTranslations } from "next-intl";

/** Two decimals, with no grouping, for the ratios and the radians. */
const RATIO_FORMAT = {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  useGrouping: false,
};

/**
 * The triangle's readouts, in two even columns: its three sides, each with the
 * color it has in the scene and the name the lesson gives it, then the angle,
 * then its sine, cosine, tangent and radians at the angle the learner set.
 */
export function TriangleReadout({ angle }: { angle: number }) {
  const { labels } = useTriangle();
  const t = useTranslations("Common");
  const format = useFormatter();
  /** A ratio as KaTeX writes it, with the locale's decimal comma kept whole. */
  const ratio = (value: number) =>
    `\\approx ${format.number(value, RATIO_FORMAT).replaceAll(",", "{,}")}`;
  const tangent = getTan(angle);

  return (
    <VisualCardFacts>
      {Arr.map(TRIANGLE_SIDES, (side) => (
        <VisualFactIndicator
          indicatorColor={side.color}
          key={side.key}
          label={<InlineMath math={side.symbol} />}
          value={labels[side.key]}
        />
      ))}
      <VisualFact
        label={<InlineMath math="\theta" />}
        value={<InlineMath math={`${angle}^\\circ`} />}
      />
      <VisualFact
        label={<InlineMath math="\sin\theta" />}
        value={<InlineMath math={ratio(getSin(angle))} />}
      />
      <VisualFact
        label={<InlineMath math="\cos\theta" />}
        value={<InlineMath math={ratio(getCos(angle))} />}
      />
      <VisualFact
        label={<InlineMath math="\tan\theta" />}
        value={
          Number.isFinite(tangent) ? (
            <InlineMath math={ratio(tangent)} />
          ) : (
            t("undefined")
          )
        }
      />
      <VisualFact
        label={t("radian")}
        value={format.number(getRadians(angle), RATIO_FORMAT)}
      />
    </VisualCardFacts>
  );
}
