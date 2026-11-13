import {
  arrow,
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  BLOCK_SIDES,
  blockReading,
  MaterialSchema,
} from "@repo/design-system/components/contents/physics/measurement/density/block";
import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import { steelStops } from "@repo/design-system/components/contents/physics/measurement/scale";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
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

/** The dial's full scale, in grams. */
const DIAL_FULL = 500;

/** How far the needle turns at full scale, in radians. */
const DIAL_SWEEP = (Math.PI * 5) / 3;

/** How quickly the needle settles on a new mass, per second. */
const SETTLE_RATE = 4;

/** What the sketch reads on every frame: the block's material. */
const BlockFrame = Schema.Struct({ material: MaterialSchema });

/** Each material's base color: pine, aluminium, brass. */
function materialColor(material: typeof MaterialSchema.Type) {
  if (material === "pine") {
    return MATERIAL.pine;
  }
  return material === "brass" ? MATERIAL.brass : MATERIAL.aluminium;
}

/** Positions of the scale and the block for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  const centimetre = Math.min(width * 0.065, height * 0.1);
  return { centimetre, centre: width * 0.5, platform: height * 0.56 };
}

/** The lab wall and bench. */
function paintRoom(sketch: p5) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("STONE", 600), getColor("WHITE"), 0.12)],
    [0.8, getColor("STONE", 600)],
    [0.81, mix(getColor("NEUTRAL", 700), getColor("WHITE"), 0.1)],
    [1, getColor("NEUTRAL", 800)],
  ]);
  spotlight(sketch, { x: width * 0.45, y: height * 0.2 }, width * 0.6, {
    color: MATERIAL.lampLight,
    strength: 0.3,
  });
}

/** The top-pan scale and its dial, the needle at `grams`. */
function paintScale(
  sketch: p5,
  place: ReturnType<typeof layout>,
  grams: number
) {
  const { height, width } = sketch;
  withShadow(
    sketch,
    { blur: 22, color: fade(getColor("BLACK"), 0.6), drop: 10 },
    () => {
      gradientRect(
        sketch,
        {
          height: height * 0.3,
          width: width * 0.44,
          x: place.centre - width * 0.22,
          y: place.platform + height * 0.02,
        },
        [
          [0, mix(getColor("ZINC", 100), getColor("SLATE", 300), 0.3)],
          [1, getColor("SLATE", 600)],
        ]
      );
      gradientRect(
        sketch,
        {
          height: height * 0.022,
          width: width * 0.4,
          x: place.centre - width * 0.2,
          y: place.platform,
        },
        steelStops(0.05)
      );
    }
  );
  const dial = { x: place.centre, y: place.platform + height * 0.17 };
  const radius = height * 0.1;
  litBall(sketch, dial, radius, {
    dark: getColor("SLATE", 300),
    light: getColor("WHITE"),
  });
  sketch.stroke(getColor("ZINC", 900));
  Arr.forEach(Arr.range(0, 50), (mark) => {
    const angle = -Math.PI / 2 - DIAL_SWEEP / 2 + (mark / 50) * DIAL_SWEEP;
    const major = mark % 5 === 0;
    sketch.strokeWeight(major ? 2 : 1);
    const inner = radius * (major ? 0.68 : 0.78);
    sketch.line(
      dial.x + inner * Math.cos(angle),
      dial.y + inner * Math.sin(angle),
      dial.x + radius * 0.88 * Math.cos(angle),
      dial.y + radius * 0.88 * Math.sin(angle)
    );
  });
  const needle =
    -Math.PI / 2 - DIAL_SWEEP / 2 + (grams / DIAL_FULL) * DIAL_SWEEP;
  sketch.stroke(MATERIAL.dialNeedle);
  sketch.strokeWeight(2.5);
  sketch.line(
    dial.x,
    dial.y,
    dial.x + radius * 0.85 * Math.cos(needle),
    dial.y + radius * 0.85 * Math.sin(needle)
  );
  sketch.noStroke();
  sketch.fill(getColor("ZINC", 900));
  sketch.circle(dial.x, dial.y, radius * 0.12);
}

/**
 * The block on the pan in three-quarter view, each face lit differently, the
 * grain of pine or the brushing of metal on its front, and the three edges a
 * ruler measures marked with arrows.
 */
function paintBlock(
  sketch: p5,
  place: ReturnType<typeof layout>,
  material: typeof MaterialSchema.Type
) {
  const base = materialColor(material);
  const length = BLOCK_SIDES.length * place.centimetre;
  const tall = BLOCK_SIDES.height * place.centimetre;
  const deep = BLOCK_SIDES.width * place.centimetre * 0.45;
  const left = place.centre - length / 2 - deep * 0.4;
  const bottom = place.platform;
  const top = bottom - tall;
  withShadow(
    sketch,
    { blur: 20, color: fade(getColor("BLACK"), 0.55), drop: 8 },
    () => {
      gradientRect(sketch, { height: tall, width: length, x: left, y: top }, [
        [0, mix(base, getColor("WHITE"), 0.1)],
        [1, mix(base, getColor("BLACK"), 0.3)],
      ]);
    }
  );
  sketch.fill(mix(base, getColor("WHITE"), 0.35));
  sketch.quad(
    left,
    top,
    left + length,
    top,
    left + length + deep,
    top - deep * 0.7,
    left + deep,
    top - deep * 0.7
  );
  sketch.fill(mix(base, getColor("BLACK"), 0.4));
  sketch.quad(
    left + length,
    top,
    left + length + deep,
    top - deep * 0.7,
    left + length + deep,
    bottom - deep * 0.7,
    left + length,
    bottom
  );
  sketch.stroke(
    fade(
      mix(base, getColor(material === "pine" ? "BLACK" : "WHITE"), 0.45),
      material === "pine" ? 0.45 : 0.25
    )
  );
  sketch.strokeWeight(material === "pine" ? 1.6 : 0.8);
  const lines = material === "pine" ? 7 : 16;
  for (let line = 1; line < lines; line += 1) {
    const y = top + (tall * line) / lines;
    const wave = material === "pine" ? Math.sin(line * 1.9) * tall * 0.05 : 0;
    sketch.line(left, y + wave, left + length, y - wave);
  }
  sketch.noStroke();
  const ink = { color: PLOT_COLORS.orange, head: 9, weight: 2.5 };
  const lengthY = bottom + sketch.height * 0.045;
  arrow(
    sketch,
    { x: left + length / 2, y: lengthY },
    { x: left, y: lengthY },
    ink
  );
  arrow(
    sketch,
    { x: left + length / 2, y: lengthY },
    { x: left + length, y: lengthY },
    ink
  );
  const heightX = left - sketch.width * 0.03;
  const tallInk = { ...ink, color: PLOT_COLORS.violet };
  arrow(
    sketch,
    { x: heightX, y: top + tall / 2 },
    { x: heightX, y: top },
    tallInk
  );
  arrow(
    sketch,
    { x: heightX, y: top + tall / 2 },
    { x: heightX, y: bottom },
    tallInk
  );
  const widthInk = { ...ink, color: PLOT_COLORS.teal };
  const from = { x: left + length + sketch.width * 0.02, y: bottom };
  const to = {
    x: left + length + deep + sketch.width * 0.02,
    y: bottom - deep * 0.7,
  };
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  arrow(sketch, middle, from, widthInk);
  arrow(sketch, middle, to, widthInk);
}

/** Draws one moment: the needle settles on the block's mass. */
function blockProgram(sketch: p5, read: () => typeof BlockFrame.Type) {
  let grams = blockReading(read().material).mass;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { material } = read();
    const target = blockReading(material).mass;
    const step = Math.min(sketch.deltaTime / 1000, 0.1) * SETTLE_RATE;
    grams = sketch.isLooping()
      ? grams + (target - grams) * Math.min(step, 1)
      : target;
    const place = layout(sketch);
    paintRoom(sketch);
    paintScale(sketch, place, grams);
    paintBlock(sketch, place, material);
    vignette(sketch, 0.35);
  };
}

interface DensityMeasurementLabProps {
  description: ReactNode;
  labels: {
    chooseMaterial: string;
    density: ReactNode;
    densitySi: ReactNode;
    mass: ReactNode;
    materials: Record<typeof MaterialSchema.Type, ReactNode>;
    sides: ReactNode;
    viewLabel: string;
    volume: ReactNode;
  };
  title: ReactNode;
}

/**
 * Three blocks of the same size, pine, aluminium and brass, on a dial scale.
 * A ruler gives three lengths and the scale one mass, all base quantities;
 * the volume and the density are derived from them.
 */
export function DensityMeasurementLab({
  description,
  labels,
  title,
}: DensityMeasurementLabProps) {
  const [material, setMaterial] =
    useState<typeof MaterialSchema.Type>("aluminium");
  const fixed = useFixed();
  const { density, densitySi, mass, volume } = blockReading(material);
  const isMaterial = Schema.is(MaterialSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseMaterial}
          gridColumns="3"
          onValueChange={(value) => {
            if (isMaterial(value)) {
              setMaterial(value);
            }
          }}
          type="single"
          value={material}
          variant="outline"
        >
          {Arr.map(MaterialSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.materials[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={blockProgram}
          state={{ material }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.sides}
            value={
              <InlineMath
                math={`${fixed(BLOCK_SIDES.length, "", 1)}\\times${fixed(BLOCK_SIDES.width, "", 1)}\\times${fixed(BLOCK_SIDES.height, "\\text{ cm}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.volume}
            value={
              <InlineMath math={`V=${fixed(volume, "\\text{ cm}^3", 0)}`} />
            }
          />
          <VisualFactTabular
            label={labels.mass}
            value={<InlineMath math={`m=${fixed(mass, "\\text{ g}", 0)}`} />}
          />
          <VisualFactTabular
            label={labels.density}
            value={
              <InlineMath
                math={`\\rho=\\frac{m}{V}=${fixed(density, "\\text{ g/cm}^3", 2)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.densitySi}
            value={<InlineMath math={fixed(densitySi, "\\text{ kg/m}^3", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
