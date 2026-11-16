import {
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  fringeSpacing,
  loudPoints,
  twoSourceIntensity,
} from "@repo/design-system/components/contents/physics/waves/wave";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** Wall seconds a crest takes to travel one wavelength. */
const PERIOD_SECONDS = 0.9;

/** Wall seconds the student takes to walk the whole line one way. */
const WALK_SECONDS = 9;

/** What the sketch reads on every frame. */
const SoundFrameSchema = Schema.Struct({
  distance: Schema.Finite,
  separation: Schema.Finite,
  wavelength: Schema.Finite,
});
type SoundFrame = typeof SoundFrameSchema.Type;

/**
 * Draws one moment, seen from above: the two loudspeakers with the crests
 * spreading from each, the line the student walks with the loudness along it
 * plotted as a bright band, each loud point marked, and the student walking
 * with a meter that rises and falls.
 */
function soundProgram(sketch: p5, read: () => SoundFrame) {
  let phase = 0;
  let walk = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      const step = Math.min(sketch.deltaTime / 1000, 0.1);
      phase = (phase + step / PERIOD_SECONDS) % 1;
      walk = (walk + step / WALK_SECONDS) % 2;
    }
    const { height, width } = sketch;
    const reach = frame.separation * 2.2;
    const scale = Math.min(
      (width * 0.78) / frame.distance,
      (height * 0.9) / (2 * reach)
    );
    const source = { x: width * 0.1, y: height / 2 };
    const line = source.x + frame.distance * scale;
    gradientRect(sketch, { height, width, x: 0, y: 0 }, [
      [0, mix(MATERIAL.grass, getColor("BLACK"), 0.35)],
      [1, mix(MATERIAL.grass, getColor("BLACK"), 0.55)],
    ]);
    const speakers = Arr.map([-1, 1], (side) => ({
      x: source.x,
      y: source.y + (side * frame.separation * scale) / 2,
    }));
    sketch.noFill();
    for (const speaker of speakers) {
      const most = Math.ceil((frame.distance * 1.3) / frame.wavelength);
      for (let ring = 0; ring < most; ring += 1) {
        const radius = (ring + phase) * frame.wavelength * scale;
        sketch.stroke(fade(getColor("WHITE"), 0.22 * (1 - ring / most)));
        sketch.strokeWeight(1.5);
        sketch.arc(
          speaker.x,
          speaker.y,
          radius * 2,
          radius * 2,
          -Math.PI / 2,
          Math.PI / 2
        );
      }
    }
    const top = source.y - reach * scale;
    const bottom = source.y + reach * scale;
    for (let y = top; y <= bottom; y += 1) {
      const loud = twoSourceIntensity(frame, (y - source.y) / scale);
      sketch.stroke(fade(PLOT_COLORS.amber, 0.15 + 0.8 * loud));
      sketch.strokeWeight(1);
      sketch.line(line - 4 - loud * width * 0.08, y, line - 4, y);
    }
    sketch.stroke(fade(getColor("WHITE"), 0.8));
    sketch.strokeWeight(2);
    sketch.line(line, top, line, bottom);
    sketch.noStroke();
    for (const point of loudPoints(frame, reach)) {
      sketch.fill(PLOT_COLORS.amber);
      sketch.circle(line, source.y + point * scale, 9);
    }
    for (const speaker of speakers) {
      sketch.fill(getColor("NEUTRAL", 800));
      sketch.rect(speaker.x - 14, speaker.y - 11, 16, 22, 3);
      sketch.fill(getColor("NEUTRAL", 700));
      sketch.circle(speaker.x - 2, speaker.y, 14);
    }
    const along = (walk < 1 ? walk : 2 - walk) * 2 - 1;
    const studentY = source.y + along * reach * scale * 0.95;
    const loudness = twoSourceIntensity(frame, (studentY - source.y) / scale);
    sketch.fill(MATERIAL.trolleyPaint);
    sketch.circle(line + 16, studentY, 18);
    sketch.fill(MATERIAL.hair);
    sketch.circle(line + 16, studentY, 10);
    sketch.fill(getColor("NEUTRAL", 800));
    sketch.rect(line + 30, studentY - 20, 8, 40, 2);
    sketch.fill(PLOT_COLORS.teal);
    sketch.rect(line + 31, studentY + 19 - 38 * loudness, 6, 38 * loudness, 2);
    vignette(sketch, 0.3);
  };
}

interface SpeakerInterferenceLabProps {
  description: NonNullable<ReactNode>;
  /** The distance from the loudspeakers to the line the student walks, in metres. */
  distance: number;
  /** The frequency the signal generator starts at, in hertz. */
  frequency: number;
  labels: {
    frequency: ReactNode;
    frequencyName: string;
    spacing: ReactNode;
    viewLabel: string;
    wavelength: ReactNode;
  };
  /** The distance between the loudspeakers, in metres. */
  separation: number;
  /** The speed of sound in air, in metres per second. */
  speed: number;
  title: NonNullable<ReactNode>;
}

/**
 * Two loudspeakers on one signal generator, seen from above, and a student
 * walking along a line in front of them with a sound meter. Where the waves
 * from both arrive in step the sound is loud; between those points it nearly
 * vanishes. Change the frequency and watch the wavelength, and with it the
 * spacing of the loud points, change.
 */
export function SpeakerInterferenceLab({
  description,
  distance,
  frequency: start,
  labels,
  separation,
  speed,
  title,
}: SpeakerInterferenceLabProps) {
  const quantity = useQuantity();
  const [frequency, setFrequency] = useState(start);
  const wavelength = speed / frequency;
  const spacing = fringeSpacing(wavelength, separation, distance);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.frequency}</span>}
          max={Math.max(2000, start * 1.5)}
          min={Math.max(200, Math.round(start / 4 / 50) * 50)}
          name={labels.frequencyName}
          onValueChange={setFrequency}
          readout={<InlineMath math={quantity(frequency, "\\text{ Hz}", 0)} />}
          step={50}
          value={frequency}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={soundProgram}
          state={{ distance, separation, wavelength }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.wavelength}
            value={
              <InlineMath
                math={`\\lambda=${quantity(wavelength, "\\text{ m}", 2)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.spacing}
            value={
              <InlineMath math={`x=${quantity(spacing, "\\text{ m}", 2)}`} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
