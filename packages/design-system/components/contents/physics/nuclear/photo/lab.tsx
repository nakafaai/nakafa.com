import {
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { photoelectric } from "@repo/design-system/components/contents/physics/nuclear/decay";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { LIGHT_COLORS } from "@repo/design-system/lib/material/light";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * The colour a camera records for light of `wavelength` nanometres, from a
 * piecewise approximation of the visible spectrum, with ultraviolet drawn as
 * a deep violet.
 */
function spectrum(wavelength: number) {
  const stops: readonly (readonly [number, string])[] = [
    [380, PLOT_COLORS.violet],
    [450, LIGHT_COLORS.spectrumBlue],
    [495, LIGHT_COLORS.spectrumCyan],
    [530, LIGHT_COLORS.spectrumGreen],
    [580, LIGHT_COLORS.spectrumYellow],
    [620, LIGHT_COLORS.spectrumOrange],
    [700, LIGHT_COLORS.spectrumRed],
  ];
  const upper = Arr.findFirstIndex(stops, ([edge]) => edge >= wavelength);
  if (Option.isNone(upper)) {
    return LIGHT_COLORS.spectrumRed;
  }
  const high = stops[upper.value];
  const low = stops[Math.max(upper.value - 1, 0)];
  if (!(high && low) || high[0] === low[0]) {
    return high?.[1] ?? PLOT_COLORS.violet;
  }
  return mix(low[1], high[1], (wavelength - low[0]) / (high[0] - low[0]));
}

/** What the sketch reads on every frame. */
const PhotoFrameSchema = Schema.Struct({
  emits: Schema.Boolean,
  intensity: Schema.Finite,
  kinetic: Schema.Finite,
  wavelength: Schema.Finite,
});
type PhotoFrame = typeof PhotoFrameSchema.Type;

/**
 * Draws one moment inside an evacuated tube: a lamp on the left sends
 * photons of the chosen colour, as many each second as the intensity says,
 * onto a metal plate. Where one photon carries more than the work function,
 * an electron leaves the plate at a speed that grows with its greatest
 * kinetic energy; otherwise the photons are absorbed and nothing leaves.
 */
function photoProgram(sketch: p5, read: () => PhotoFrame) {
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock += Math.min(sketch.deltaTime / 1000, 0.1);
    }
    const { height, width } = sketch;
    gradientRect(sketch, { height, width, x: 0, y: 0 }, [
      [0, mix(ENERGY_COLORS.nightSky, getColor("WHITE"), 0.05)],
      [1, getColor("ZINC", 950)],
    ]);
    const tube = {
      height: height * 0.62,
      width: width * 0.86,
      x: width * 0.07,
      y: height * 0.19,
    };
    sketch.noStroke();
    sketch.fill(fade(BENCH_COLORS.glass, 0.08));
    sketch.rect(tube.x, tube.y, tube.width, tube.height, tube.height * 0.5);
    sketch.noFill();
    sketch.stroke(fade(BENCH_COLORS.glass, 0.6));
    sketch.strokeWeight(2);
    sketch.rect(tube.x, tube.y, tube.width, tube.height, tube.height * 0.5);
    const plate = { x: width * 0.6, y: height * 0.32 };
    sketch.noStroke();
    sketch.fill(INSTRUMENT_COLORS.aluminium);
    sketch.rect(plate.x, plate.y, width * 0.03, height * 0.36);
    const color = spectrum(frame.wavelength);
    const lamp = { x: width * 0.14, y: height * 0.5 };
    spotlight(sketch, lamp, width * 0.12, { color, strength: 0.6 });
    sketch.fill(mix(color, getColor("WHITE"), 0.5));
    sketch.circle(lamp.x, lamp.y, 18);
    const photons = Math.round(6 + frame.intensity * 14);
    const flight = 1.2;
    Arr.forEach(
      Arr.makeBy(photons, (index) => index),
      (index) => {
        const phase = (hashUnit(index, 0) * flight + clock) % flight;
        const share = phase / flight;
        const targetY = plate.y + hashUnit(index, 1) * height * 0.36;
        const x = lamp.x + (plate.x - lamp.x) * share;
        const y = lamp.y + (targetY - lamp.y) * share;
        sketch.stroke(color);
        sketch.strokeWeight(2);
        sketch.noFill();
        const wave = 6;
        sketch.line(
          x - wave,
          y + Math.sin(share * 40) * 2,
          x + wave,
          y - Math.sin(share * 40) * 2
        );
        if (frame.emits) {
          const out = (phase + flight * 0.5) % flight;
          const fly = Math.sqrt(frame.kinetic) * width * 0.25 * (out / flight);
          sketch.noStroke();
          sketch.fill(PLOT_COLORS.teal);
          sketch.circle(
            plate.x + width * 0.04 + fly,
            targetY - fly * 0.2 * (hashUnit(index, 2) - 0.5),
            5
          );
        }
      }
    );
    vignette(sketch, 0.3);
  };
}

interface PhotoelectricLabProps {
  /** The elementary charge, in coulombs, which turns joules into electronvolts. */
  charge: number;
  description: NonNullable<ReactNode>;
  labels: {
    energy: ReactNode;
    intensity: ReactNode;
    intensityName: string;
    kinetic: ReactNode;
    none: ReactNode;
    viewLabel: string;
    wavelength: ReactNode;
    wavelengthName: string;
  };
  /** The speed of light, in m s⁻¹. */
  lightSpeed: number;
  /** Planck's constant, in J s. */
  planck: number;
  title: NonNullable<ReactNode>;
  /** The wavelength of the light the lab starts with, in nanometres. */
  wavelength: number;
  /** The work function of the metal, in electronvolts. */
  workFunction: number;
}

/**
 * Light falls on a metal plate in an evacuated tube. Each photon gives its
 * energy, h c / λ, to one electron: below the work function nothing leaves
 * however bright the light, and above it electrons leave with the energy to
 * spare. Change the colour and the brightness and see which one decides
 * whether electrons come out.
 */
export function PhotoelectricLab({
  charge,
  description,
  labels,
  lightSpeed,
  planck,
  title,
  wavelength: start,
  workFunction,
}: PhotoelectricLabProps) {
  const quantity = useQuantity();
  const [wavelength, setWavelength] = useState(start);
  const [intensity, setIntensity] = useState(0.5);
  const photon = photoelectric(wavelength, workFunction, {
    charge,
    light: lightSpeed,
    planck,
  });

  return (
    <VisualCard
      onReset={() => {
        setWavelength(start);
        setIntensity(0.5);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-4">
          <LabSlider
            label={<span>{labels.wavelength}</span>}
            max={700}
            min={300}
            name={labels.wavelengthName}
            onValueChange={setWavelength}
            readout={
              <InlineMath math={quantity(wavelength, "\\text{ nm}", 0)} />
            }
            step={10}
            value={wavelength}
          />
          <LabSlider
            label={<span>{labels.intensity}</span>}
            max={100}
            min={10}
            name={labels.intensityName}
            onValueChange={(value) => setIntensity(value / 100)}
            readout={<InlineMath math={quantity(intensity * 100, "\\%", 0)} />}
            step={10}
            value={Math.round(intensity * 100)}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={photoProgram}
          state={{
            emits: photon.emits,
            intensity,
            kinetic: photon.kinetic,
            wavelength,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.energy}
            value={
              <InlineMath math={quantity(photon.energy, "\\text{ eV}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.kinetic}
            value={
              photon.emits ? (
                <InlineMath math={quantity(photon.kinetic, "\\text{ eV}", 2)} />
              ) : (
                labels.none
              )
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
