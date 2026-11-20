import { FLOOR } from "@repo/design-system/components/contents/biology/capillary/bed";
import { CapillaryScene } from "@repo/design-system/components/contents/biology/capillary/scene";
import type { Bed } from "@repo/design-system/components/contents/biology/capillary/starling";
import {
  arterialRange,
  lymphShare,
  netPressure,
  oncoticRange,
  turning,
} from "@repo/design-system/components/contents/biology/capillary/starling";
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
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

/** The unit of every pressure, as KaTeX. */
const MMHG = "\\text{ mmHg}";

/**
 * A capillary bed, cut out of the tissue and opened: an arteriole feeds the
 * capillaries, they drain into a venule, and a lymph capillary lies among the
 * tissue cells. Along each capillary the blood pressure falls from the
 * arterial to the venous end while the plasma proteins pull with the same
 * force all along, so fluid leaves the blood where the net pressure pushes
 * out and returns where it pulls in (the Starling relation). What does not
 * return stays in the tissue until the lymph drains it. The learner raises
 * the blood pressure or lowers the plasma protein and watches the tissue
 * keep more fluid, the swelling of oedema.
 *
 * The lab models the capillary as school textbooks teach it, filtering at
 * the arterial end and reabsorbing at the venous end. Measurements since
 * show that in most tissues little fluid is reabsorbed for long, and the
 * lymph carries most of what is filtered (Levick and Michel, "Microvascular
 * fluid exchange and the revised Starling principle", Cardiovascular
 * Research 87, 2010, 198-210).
 */
export function CapillaryBedLab({
  description,
  labels,
  oncotic,
  pressure,
  tissue,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly arterial: string;
    readonly inward: ReactNode;
    readonly lymph: ReactNode;
    readonly oncotic: string;
    readonly outward: ReactNode;
    readonly parts: {
      readonly arteriole: ReactNode;
      readonly capillary: ReactNode;
      readonly cell: ReactNode;
      readonly lymph: ReactNode;
      readonly venule: ReactNode;
    };
    readonly turning: ReactNode;
    readonly view: string;
  };
  readonly oncotic: number;
  readonly pressure: { readonly arterial: number; readonly venous: number };
  readonly tissue: { readonly oncotic: number; readonly pressure: number };
  readonly title: NonNullable<ReactNode>;
}) {
  const quantity = useQuantity();
  const [arterial, setArterial] = useState(pressure.arterial);
  const [pull, setPull] = useState(oncotic);
  const authored: Bed = {
    arterial: pressure.arterial,
    oncotic,
    tissue,
    venous: pressure.venous,
  };
  const pressures = arterialRange(authored);
  const pulls = oncoticRange(authored);
  const bed = useMemo(
    () => ({ arterial, oncotic: pull, tissue, venous: pressure.venous }),
    [arterial, pull, tissue, pressure.venous]
  );
  const worst = useMemo(
    () => ({ ...bed, arterial: pressures.max, oncotic: pulls.min }),
    [bed, pressures.max, pulls.min]
  );
  const share = lymphShare(bed);
  const start = netPressure(bed, 0);
  const end = netPressure(bed, 1);
  const turn = turning(bed);
  const push =
    tissue.pressure === 0 ? "" : ` ${signed(tissue.pressure, quantity)}`;
  const draw =
    tissue.oncotic === 0
      ? quantity(pull, "", 0)
      : `(${quantity(pull, "", 0)} - ${quantity(tissue.oncotic, "", 0)})`;
  const starling = (blood: number) =>
    `${quantity(blood, "", 0)}${push} - ${draw}`;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.arterial}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(arterial, MMHG, 0)} />
            </span>
          </div>
          <Slider
            aria-label={labels.arterial}
            max={pressures.max}
            min={pressures.min}
            onValueChange={(value: number) => setArterial(value)}
            step={1}
            value={arterial}
          />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.oncotic}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(pull, MMHG, 0)} />
            </span>
          </div>
          <Slider
            aria-label={labels.oncotic}
            max={pulls.max}
            min={pulls.min}
            onValueChange={(value: number) => setPull(value)}
            step={1}
            value={pull}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={-FLOOR} reach={13} setting="studio">
          <Suspense fallback={null}>
            <CapillaryScene
              bed={bed}
              inflow={share}
              labels={labels.parts}
              worst={worst}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.outward}
            value={
              <InlineMath
                math={`${starling(arterial)} = ${quantity(start, MMHG, 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.inward}
            value={
              <InlineMath
                math={`${starling(pressure.venous)} = ${quantity(end, MMHG, 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.turning}
            value={
              <InlineMath
                math={
                  start > 0 && end < 0
                    ? `\\dfrac{${quantity(start, "", 1)}}{${quantity(start, "", 1)} + ${quantity(-end, "", 1)}} = ${quantity(turn * 100, "\\%", 0)}`
                    : quantity(turn * 100, "\\%", 0)
                }
              />
            }
          />
          <VisualFactTabular
            label={labels.lymph}
            value={<InlineMath math={quantity(share * 100, "\\%", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** A pressure subtracted in a sum, as KaTeX: "- 2" for a push, "+ 3" for a pressure below zero. */
function signed(value: number, quantity: ReturnType<typeof useQuantity>) {
  return value < 0
    ? `+ ${quantity(-value, "", 0)}`
    : `- ${quantity(value, "", 0)}`;
}
