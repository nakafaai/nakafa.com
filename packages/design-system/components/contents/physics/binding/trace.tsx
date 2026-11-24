import type { NuclideId } from "@repo/design-system/components/contents/physics/binding/model";
import { nuclideSpec } from "@repo/design-system/components/contents/physics/binding/model";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";

const WIDTH = 200;
const HEIGHT = 88;
const CURVE_NUCLIDES: readonly NuclideId[] = [
  "deuterium",
  "helium4",
  "carbon12",
  "iron56",
  "uranium235",
];

function xForMass(massNumber: number): number {
  return 10 + (Math.log10(massNumber) / Math.log10(250)) * (WIDTH - 20);
}

function yForBinding(mev: number): number {
  return HEIGHT - 6 - (mev / 9.5) * (HEIGHT - 14);
}

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
  const points = Arr.join(
    Arr.map(CURVE_NUCLIDES, (id) => {
      const spec = nuclideSpec(id);
      return `${xForMass(spec.massNumber)},${yForBinding(spec.bindingPerNucleonMev)}`;
    }),
    " "
  );
  const current = nuclideSpec(active);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground flex flex-wrap justify-between gap-x-4 text-xs">
        <span style={{ color: QUANTUM_COLORS.fusionZone }}>{fusionLabel}</span>
        <span style={{ color: QUANTUM_COLORS.ironPeak }}>{peakLabel}</span>
        <span style={{ color: QUANTUM_COLORS.fissionZone }}>
          {fissionLabel}
        </span>
      </div>
      <div className="relative h-24 px-1 pb-1">
        <div className="border-border relative h-full border-s border-b">
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <polyline
              fill="none"
              points={points}
              stroke={QUANTUM_COLORS.ironPeak}
              strokeLinejoin="round"
              strokeWidth={2.2}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={xForMass(current.massNumber)}
              cy={yForBinding(current.bindingPerNucleonMev)}
              fill={QUANTUM_COLORS.proton}
              r={4}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
