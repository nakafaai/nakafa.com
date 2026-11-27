import { sampleBoltzmann } from "@repo/design-system/components/contents/chemistry/collision/model";
import {
  TraceChart,
  TraceFill,
  TraceGuide,
} from "@repo/design-system/components/contents/simulation/trace";
import { KINETICS_COLORS } from "@repo/design-system/lib/material/kinetics";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

/** How many points the distribution is drawn through. */
const STEPS = 100;
/** The activation energy on the normalized energy axis, where the model sets it. */
const ACTIVATION = 0.62;

/**
 * The Maxwell-Boltzmann distribution of kinetic energies at the lab's
 * temperature, with the activation energy as a dashed line and the share of
 * particles beyond it shaded.
 */
export function BoltzmannTrace({
  activationLabel,
  shadedLabel,
  temperatureK,
}: {
  readonly activationLabel: ReactNode;
  readonly shadedLabel: string;
  readonly temperatureK: number;
}) {
  const data = useMemo(
    () =>
      Arr.map(sampleBoltzmann(temperatureK, STEPS), (point) => ({
        density: point.density,
        energy: point.energy,
        tail: point.aboveEa ? point.density : null,
      })),
    [temperatureK]
  );

  return (
    <TraceChart
      data={data}
      marks={[
        {
          color: KINETICS_COLORS.activationLine,
          kind: "dashed",
          label: activationLabel,
        },
        { color: KINETICS_COLORS.shadedArea, kind: "band", label: shadedLabel },
      ]}
      series={[{ color: KINETICS_COLORS.reactant, key: "density" }]}
      x={{ domain: [0, 1], key: "energy" }}
      y={{ domain: [0, 1.1], ticks: [0, 0.5, 1] }}
    >
      <TraceFill color={KINETICS_COLORS.shadedArea} dataKey="tail" />
      <TraceGuide color={KINETICS_COLORS.activationLine} x={ACTIVATION} />
    </TraceChart>
  );
}
