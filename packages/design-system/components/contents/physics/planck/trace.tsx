import type { RadiationModel } from "@repo/design-system/components/contents/physics/planck/model";
import {
  evaluateBlackbody,
  sampleBlackbodySpectrum,
} from "@repo/design-system/components/contents/physics/planck/model";
import {
  TraceBand,
  TraceChart,
  TraceCursor,
} from "@repo/design-system/components/contents/simulation/trace";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** How many points each spectrum is drawn through. */
const STEPS = 96;
/** The wavelengths the axis covers and the band of them the eye sees, in nanometers. */
const RANGE = { max: 2000, min: 200 } as const;
const VISIBLE = { max: 750, min: 380 } as const;

/**
 * The spectrum of a blackbody at the lab's temperature: Planck's curve, the
 * classical one that leaves the plot toward short wavelengths when the lab
 * shows it, the visible band shaded, and a cursor at the peak wavelength.
 */
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
  const data = useMemo(
    () =>
      Arr.map(sampleBlackbodySpectrum(temperatureK, STEPS), (point) => ({
        classical: point.classical,
        planck: point.planck,
        wavelength: point.wavelengthNm,
      })),
    [temperatureK]
  );
  const peak = evaluateBlackbody(temperatureK).peakWavelengthNm;

  return (
    <TraceChart
      data={data}
      marks={[
        { color: QUANTUM_COLORS.sunCore, kind: "band", label: visibleLabel },
      ]}
      series={[
        {
          color: QUANTUM_COLORS.planckCurve,
          key: "planck",
          label: planckLabel,
        },
        ...(model === "classical"
          ? [
              {
                color: QUANTUM_COLORS.classicalCurve,
                dashed: true,
                key: "classical",
                label: classicalLabel,
              },
            ]
          : []),
      ]}
      x={{
        domain: [RANGE.min, RANGE.max],
        key: "wavelength",
        ticks: [200, 500, 1000, 1500, 2000],
      }}
      y={{ domain: [0, 1.2], ticks: [0, 0.5, 1] }}
    >
      <TraceBand
        color={QUANTUM_COLORS.sunCore}
        from={VISIBLE.min}
        to={VISIBLE.max}
      />
      <TraceCursor x={Math.min(RANGE.max, Math.max(RANGE.min, peak))} />
    </TraceChart>
  );
}
