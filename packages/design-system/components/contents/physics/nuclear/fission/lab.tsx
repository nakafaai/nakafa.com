import { fissionEnergy } from "@repo/design-system/components/contents/physics/nuclear/decay";
import { Masses } from "@repo/design-system/components/contents/physics/nuclear/fission/masses";
import { FissionScene } from "@repo/design-system/components/contents/physics/nuclear/fission/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense } from "react";

interface FissionLabProps {
  description: NonNullable<ReactNode>;
  /** The masses of the two fission fragments, in atomic mass units. */
  fragments: readonly [number, number];
  labels: {
    defect: ReactNode;
    energy: ReactNode;
    kilograms: ReactNode;
    viewLabel: string;
  };
  /** The speed of light, in m s⁻¹. */
  lightSpeed: number;
  /** The mass of one neutron, in atomic mass units. */
  neutron: number;
  /** The mass of the nucleus that splits, in atomic mass units. */
  parent: number;
  /** How many neutrons the fission releases. */
  released: number;
  title: NonNullable<ReactNode>;
  /** One atomic mass unit, in kilograms. */
  unit: number;
}

/**
 * A slow neutron splits a uranium nucleus into two fragments and a few fast
 * neutrons. The bars under the scene weigh everything before and after: the
 * products are a little lighter, and that mass defect is the energy the
 * fission releases, E = Δm c².
 */
export function FissionLab({
  description,
  fragments,
  labels,
  lightSpeed,
  neutron,
  parent,
  released,
  title,
  unit,
}: FissionLabProps) {
  const quantity = useQuantity();
  const fission = fissionEnergy(
    {
      after: [...fragments, ...Arr.makeBy(released, () => neutron)],
      before: [parent, neutron],
    },
    { atomic: unit, light: lightSpeed }
  );
  const exponent = Math.floor(Math.log10(fission.energy));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={3.2} setting="studio">
          <Suspense fallback={null}>
            <FissionScene released={released} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <Masses
          after={{
            label: (
              <InlineMath
                math={`m_1+m_2+${released}\\,m_{\\mathrm{n}}=${quantity(fission.after, "\\text{ u}", 4)}`}
              />
            ),
            mass: fission.after,
          }}
          before={{
            label: (
              <InlineMath
                math={`m_0+m_{\\mathrm{n}}=${quantity(fission.before, "\\text{ u}", 4)}`}
              />
            ),
            mass: fission.before,
          }}
        />
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.defect}
            value={
              <InlineMath math={quantity(fission.defect, "\\text{ u}", 4)} />
            }
          />
          <VisualFactTabular
            label={labels.kilograms}
            value={
              <InlineMath
                math={`${quantity(fission.kilograms / 10 ** Math.floor(Math.log10(fission.kilograms)), "", 2)}\\times10^{${Math.floor(Math.log10(fission.kilograms))}}\\text{ kg}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.energy}
            value={
              <InlineMath
                math={`${quantity(fission.energy / 10 ** exponent, "", 2)}\\times10^{${exponent}}\\text{ J}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
