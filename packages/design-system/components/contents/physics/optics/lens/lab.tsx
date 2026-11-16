import {
  dashed,
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  fitBench,
  paintArrow,
  paintLens,
  paintRail,
  paintRay,
  toEdge,
} from "@repo/design-system/components/contents/physics/optics/lens/bench";
import {
  type Point,
  paintDarkRoom,
} from "@repo/design-system/components/contents/physics/optics/light";
import { thinLens } from "@repo/design-system/components/contents/physics/optics/ray";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** What the sketch reads on every frame: the focal length and the object distance, in centimetres. */
const LensFrameSchema = Schema.Struct({
  focal: Schema.Finite,
  object: Schema.Finite,
});
type LensFrame = typeof LensFrameSchema.Type;

/**
 * Draws one moment: the bench, the lens, the object arrow, the three
 * principal rays from its tip, and the image where they meet, or where their
 * dashed extensions meet behind the lens for a virtual image.
 */
function lensProgram(sketch: p5, read: () => LensFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { focal, object } = read();
    const image = thinLens(focal, object);
    const bench = fitBench(sketch, focal, object, image);
    paintDarkRoom(sketch);
    paintRail(sketch, bench, focal);
    const at = (centimetres: number, up: number) => ({
      x: bench.lens + centimetres * bench.scale,
      y: bench.axis - up * bench.height,
    });
    const base = at(-object, 0);
    const tip = at(-object, 1);
    const focusFar = at(focal, 0);
    const focusNear = at(-focal, 0);
    const centre = at(0, 0);
    const parallel = at(0, 1);
    const through =
      Math.abs(tip.x - focusNear.x) < 1
        ? Option.none<number>()
        : Option.some(
            bench.axis +
              ((tip.y - bench.axis) * (bench.lens - focusNear.x)) /
                (tip.x - focusNear.x)
          );
    const imageTip = Option.map(image, (found) =>
      at(found.distance, found.magnification)
    );
    const virtual = Option.exists(image, (found) => !found.real);
    const back = (from: Point) =>
      virtual
        ? Option.map(imageTip, (to) => [from, to] as const)
        : Option.none();
    const reach = Math.max(
      bench.height * 1.4,
      Math.abs(bench.axis - Option.getOrElse(through, () => bench.axis)) + 12
    );
    paintLens(sketch, bench, Math.min(reach, sketch.height * 0.4));
    paintRay(sketch, {
      after: [parallel, toEdge(sketch, parallel, focusFar)],
      back: back(parallel),
      before: [tip, parallel],
    });
    paintRay(sketch, {
      after: [centre, toEdge(sketch, tip, centre)],
      back: back(centre),
      before: [tip, centre],
    });
    Option.map(through, (y) => {
      const hit = { x: bench.lens, y };
      if (object < focal) {
        dashed(sketch, focusNear, tip, {
          color: fade(MATERIAL.lampLight, 0.45),
          dash: 4,
          weight: 1.2,
        });
      }
      paintRay(sketch, {
        after: [hit, { x: sketch.width, y }],
        back: back(hit),
        before: [tip, hit],
      });
    });
    paintArrow(sketch, base, tip, PLOT_COLORS.teal, false);
    Option.map(imageTip, (to) =>
      paintArrow(
        sketch,
        { x: to.x, y: bench.axis },
        to,
        PLOT_COLORS.pink,
        virtual
      )
    );
    vignette(sketch, 0.3);
  };
}

interface ConvexLensLabProps {
  description: ReactNode;
  /** The focal length of the lens, in centimetres. */
  focal: number;
  labels: {
    distance: ReactNode;
    distanceName: string;
    image: ReactNode;
    magnification: ReactNode;
    nature: ReactNode;
    noImage: ReactNode;
    presets: string;
    real: ReactNode;
    viewLabel: string;
    virtual: ReactNode;
  };
  /** The object distance the lab starts at, in centimetres. */
  object: number;
  /** Object distances, in centimetres, that the toolbar offers one tap away. */
  presets?: readonly number[];
  title: ReactNode;
}

/**
 * An object arrow in front of a convex lens on an optical bench. Three
 * principal rays from its tip find the image: one parallel to the axis bends
 * through the far focal point, one through the centre goes straight on, and
 * one through the near focal point leaves parallel. Slide the object across
 * the focal point and watch the real, inverted image turn into a virtual,
 * upright one behind the lens.
 */
export function ConvexLensLab({
  description,
  focal,
  labels,
  object: start,
  presets = [],
  title,
}: ConvexLensLabProps) {
  const quantity = useQuantity();
  const [object, setObject] = useState(start);
  const image = thinLens(focal, object);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-4">
          <LabSlider
            label={<span>{labels.distance}</span>}
            max={Math.ceil(focal * 4)}
            min={Math.max(1, Math.round(focal * 0.2))}
            name={labels.distanceName}
            onValueChange={setObject}
            readout={<InlineMath math={quantity(object, "\\text{ cm}", 0)} />}
            step={1}
            value={object}
          />
          {Arr.isReadonlyArrayNonEmpty(presets) ? (
            <ToggleGroup
              aria-label={labels.presets}
              onValueChange={(value) => setObject(Number(value))}
              type="single"
              value={String(object)}
              variant="outline"
            >
              {Arr.map(presets, (preset) => (
                <ToggleGroupItem key={preset} value={String(preset)}>
                  <InlineMath
                    math={`u=${quantity(preset, "\\text{ cm}", 0)}`}
                  />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={lensProgram}
          state={{ focal, object }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.image}
            value={Option.match(image, {
              onNone: () => labels.noImage,
              onSome: (found) => (
                <InlineMath
                  math={`v=${quantity(found.distance, "\\text{ cm}", 1)}`}
                />
              ),
            })}
          />
          <VisualFactTabular
            label={labels.magnification}
            value={Option.match(image, {
              onNone: () => labels.noImage,
              onSome: (found) => (
                <InlineMath
                  math={quantity(Math.abs(found.magnification), "\\times", 2)}
                />
              ),
            })}
          />
          <VisualFactTabular
            label={labels.nature}
            value={Option.match(image, {
              onNone: () => labels.noImage,
              onSome: (found) => (found.real ? labels.real : labels.virtual),
            })}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
