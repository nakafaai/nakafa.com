import type { NuclideId } from "@repo/design-system/components/contents/physics/binding/model";
import { nuclideSpec } from "@repo/design-system/components/contents/physics/binding/model";
import {
  TraceBand,
  TraceChart,
  TraceGuide,
  TracePoint,
} from "@repo/design-system/components/contents/simulation/trace";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";

const CURVE_NUCLIDES: readonly NuclideId[] = [
  "deuterium",
  "helium4",
  "carbon12",
  "iron56",
  "uranium235",
];
/** The mass numbers the axis covers on its logarithmic scale, and the one of the most tightly bound nucleus. */
const MASS = { max: 250, min: 1.5, peak: 56 } as const;

const CURVE = Arr.map(CURVE_NUCLIDES, (id) => {
  const spec = nuclideSpec(id);
  return { binding: spec.bindingPerNucleonMev, mass: spec.massNumber };
});

/**
 * The binding energy per nucleon against the mass number: light nuclei gain
 * by fusing, heavy ones by splitting, and both meet at the iron peak. The
 * lab's nuclide is the point on the curve.
 */
export function BindingCurveTrace({
  active,
  fissionLabel,
  fusionLabel,
  peakLabel,
}: {
  readonly active: NuclideId;
  readonly fissionLabel: string;
  readonly fusionLabel: string;
  readonly peakLabel: string;
}) {
  const current = nuclideSpec(active);

  return (
    <TraceChart
      data={CURVE}
      marks={[
        { color: QUANTUM_COLORS.fusionZone, kind: "band", label: fusionLabel },
        { color: QUANTUM_COLORS.ironPeak, kind: "dashed", label: peakLabel },
        {
          color: QUANTUM_COLORS.fissionZone,
          kind: "band",
          label: fissionLabel,
        },
      ]}
      series={[{ color: QUANTUM_COLORS.ironPeak, key: "binding" }]}
      x={{
        domain: [MASS.min, MASS.max],
        key: "mass",
        scale: "log",
        ticks: Arr.map(CURVE, (point) => point.mass),
      }}
      y={{ domain: [0, 10], ticks: [0, 2, 4, 6, 8, 10] }}
    >
      <TraceBand
        color={QUANTUM_COLORS.fusionZone}
        from={MASS.min}
        to={MASS.peak}
      />
      <TraceBand
        color={QUANTUM_COLORS.fissionZone}
        from={MASS.peak}
        to={MASS.max}
      />
      <TraceGuide color={QUANTUM_COLORS.ironPeak} x={MASS.peak} />
      <TracePoint
        color={QUANTUM_COLORS.proton}
        x={current.massNumber}
        y={current.bindingPerNucleonMev}
      />
    </TraceChart>
  );
}
