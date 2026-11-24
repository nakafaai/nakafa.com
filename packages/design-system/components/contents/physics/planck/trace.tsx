import type { RadiationModel } from "@repo/design-system/components/contents/physics/planck/model";
import {
  evaluateBlackbody,
  sampleBlackbodySpectrum,
} from "@repo/design-system/components/contents/physics/planck/model";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useMemo } from "react";

const WIDTH = 200;
const HEIGHT = 88;

function xOf(wavelengthNm: number): number {
  return ((wavelengthNm - 200) / 1800) * WIDTH;
}

function yOf(intensity: number): number {
  return HEIGHT - Math.min(1.2, Math.max(0, intensity)) * (HEIGHT - 12);
}

export function BlackbodySpectrumTrace({
  classicalLabel,
  model,
  planckLabel,
  temperatureK,
  visibleLabel,
}: {
  readonly classicalLabel: string;
  readonly model: RadiationModel;
  readonly planckLabel: string;
  readonly temperatureK: number;
  readonly visibleLabel: string;
}) {
  const samples = useMemo(
    () => sampleBlackbodySpectrum(temperatureK, 44),
    [temperatureK]
  );
  const peak = evaluateBlackbody(temperatureK);

  const planckPoints = useMemo(
    () =>
      Arr.join(
        Arr.map(samples, (pt) => `${xOf(pt.wavelengthNm)},${yOf(pt.planck)}`),
        " "
      ),
    [samples]
  );
  const classicalPoints = useMemo(
    () =>
      Arr.join(
        Arr.map(
          samples,
          (pt) => `${xOf(pt.wavelengthNm)},${yOf(pt.classical)}`
        ),
        " "
      ),
    [samples]
  );

  const peakX = Math.min(WIDTH, Math.max(0, xOf(peak.peakWavelengthNm)));

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground flex flex-wrap justify-between gap-x-4 text-xs">
        <span style={{ color: QUANTUM_COLORS.planckCurve }}>{planckLabel}</span>
        <span>{visibleLabel}</span>
        <span style={{ color: QUANTUM_COLORS.classicalCurve }}>
          {classicalLabel}
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
            {/* Visible band 380-750 nm */}
            <rect
              fill={QUANTUM_COLORS.sunCore}
              fillOpacity={0.14}
              height={HEIGHT}
              width={xOf(750) - xOf(380)}
              x={xOf(380)}
              y={0}
            />
            {model === "classical" ? (
              <polyline
                fill="none"
                points={classicalPoints}
                stroke={QUANTUM_COLORS.classicalCurve}
                strokeDasharray="4 3"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <polyline
              fill="none"
              points={planckPoints}
              stroke={QUANTUM_COLORS.planckCurve}
              strokeLinejoin="round"
              strokeWidth={2.4}
              vectorEffect="non-scaling-stroke"
            />
            <line
              className="stroke-foreground"
              strokeOpacity={0.45}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              x1={peakX}
              x2={peakX}
              y1={0}
              y2={HEIGHT}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
