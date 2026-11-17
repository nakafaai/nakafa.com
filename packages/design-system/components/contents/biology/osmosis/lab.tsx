import { OsmosisScene } from "@repo/design-system/components/contents/biology/osmosis/scene";
import {
  changeAt,
  isotonicPoint,
  massAfter,
  type Strip,
  tonicity,
} from "@repo/design-system/components/contents/biology/osmosis/tissue";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import { type ReactNode, Suspense, useState } from "react";

/** The unit of a sucrose concentration, as KaTeX. */
const MOLAR = "\\text{ mol dm}^{-3}";

/**
 * Potato strips soaked in a series of sucrose solutions, and one potato cell
 * drawn many times larger. A strip gains mass in a solution weaker than its
 * cell sap and loses it in a stronger one; where the change crosses zero the
 * solution is isotonic. Between two tubes the change is read as linear, so
 * the lab gives the change, and the mass a strip ends at, for any
 * concentration the learner picks.
 */
export function OsmosisLab({
  description,
  labels,
  mass,
  strips,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly change: ReactNode;
    readonly concentration: string;
    readonly isotonic: ReactNode;
    readonly mass: ReactNode;
    readonly none: ReactNode;
    readonly solution: ReactNode;
    readonly tonicities: Readonly<{
      hypertonic: ReactNode;
      hypotonic: ReactNode;
      isotonic: ReactNode;
    }>;
    readonly view: string;
  };
  readonly mass?: number;
  readonly strips: readonly [Strip, ...Strip[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const quantity = useQuantity();
  const low = Arr.reduce(strips, strips[0].concentration, (least, strip) =>
    Math.min(least, strip.concentration)
  );
  const high = Arr.reduce(strips, strips[0].concentration, (most, strip) =>
    Math.max(most, strip.concentration)
  );
  const [concentration, setConcentration] = useState(low);
  const change = changeAt(strips, concentration);
  const chosen = Arr.reduce(strips, 0, (best, strip, index) =>
    Math.abs(strip.concentration - concentration) <
    Math.abs((strips[best] ?? strips[0]).concentration - concentration)
      ? index
      : best
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.concentration}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(concentration, MOLAR, 2)} />
            </span>
          </div>
          <Slider
            aria-label={labels.concentration}
            max={high}
            min={low}
            onValueChange={(value: number) => setConcentration(value)}
            step={(high - low) / 100}
            value={concentration}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.45} setting="lab">
          <Suspense fallback={null}>
            <OsmosisScene change={change} chosen={chosen} strips={strips} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.change}
            value={
              <InlineMath
                math={`${change > 0 ? "+" : ""}${quantity(change, "\\%", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.solution}
            value={labels.tonicities[tonicity(Math.round(change * 10) / 10)]}
          />
          <VisualFactTabular
            label={labels.isotonic}
            value={Option.match(isotonicPoint(strips), {
              onNone: () => labels.none,
              onSome: (point) => (
                <InlineMath math={quantity(point, MOLAR, 2)} />
              ),
            })}
          />
          {mass !== undefined && (
            <VisualFactTabular
              label={labels.mass}
              value={
                <InlineMath
                  math={`${quantity(mass, "", 2)} \\times ${quantity(1 + change / 100, "", 3)} = ${quantity(massAfter(mass, change), "\\text{ g}", 2)}`}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
