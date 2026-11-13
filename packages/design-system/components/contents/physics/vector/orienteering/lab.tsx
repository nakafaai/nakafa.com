import {
  arrow,
  createBackdrop,
  dashed,
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  fitPlan,
  planPoint,
} from "@repo/design-system/components/contents/physics/canvas/town";
import {
  type Marks,
  MarksSchema,
  shownVector,
  type View,
  ViewSchema,
} from "@repo/design-system/components/contents/physics/vector/orienteering/marks";
import {
  paintFlag,
  paintPark,
} from "@repo/design-system/components/contents/physics/vector/orienteering/park";
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
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useMemo, useState } from "react";

/** The ring around each checkpoint on the map: A teal, B amber, C pink. */
const RINGS = [PLOT_COLORS.teal, PLOT_COLORS.amber, PLOT_COLORS.pink] as const;

/**
 * Draws the park map from above with the start O and the checkpoints A, B
 * and C, and the vector the chosen view shows: A to B, B to A, A to B drawn
 * again from C beside the dashed original, or A to B as the difference of
 * the position vectors of B (amber) and A (teal).
 */
function markProgram(
  sketch: p5,
  read: () => { readonly marks: Marks; readonly view: View }
) {
  const backdrop = createBackdrop();
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { marks, view } = read();
    const places = [{ east: 0, north: 0 }, marks.a, marks.b, marks.c];
    const easts = Arr.map(places, (place) => place.east);
    const norths = Arr.map(places, (place) => place.north);
    const wide = Math.max(...easts) - Math.min(...easts);
    const tall = Math.max(...norths) - Math.min(...norths);
    const margin = Math.max(wide, tall) * 0.16;
    const plan = fitPlan(
      sketch,
      {
        east: [Math.min(...easts) - margin, Math.max(...easts) + margin],
        north: [Math.min(...norths) - margin, Math.max(...norths) + margin],
      },
      16
    );
    const spots = Arr.map(places, (place) => planPoint(plan, place));
    backdrop(
      sketch,
      Arr.join(
        Arr.map(spots, (spot) => `${spot.x.toFixed(0)},${spot.y.toFixed(0)}`),
        ";"
      ),
      (layer) => paintPark(layer, spots)
    );
    const size = Math.max(14, Math.min(sketch.width, sketch.height) * 0.04);
    const head = size * 0.8;
    const [origin, a, b] = spots;
    if (view === "difference") {
      arrow(sketch, origin, a, { color: PLOT_COLORS.teal, head, weight: 3.5 });
      arrow(sketch, origin, b, { color: PLOT_COLORS.amber, head, weight: 3.5 });
    }
    if (view === "copy") {
      dashed(sketch, a, b, {
        color: fade(getColor("WHITE"), 0.8),
        dash: 8,
        weight: 2.5,
      });
    }
    const shown = shownVector(marks, view);
    const start = planPoint(plan, shown.from);
    arrow(
      sketch,
      start,
      {
        x: start.x + shown.vector.east * plan.scale,
        y: start.y - shown.vector.north * plan.scale,
      },
      { color: PLOT_COLORS.violet, head: head * 1.1, weight: 4.5 }
    );
    sketch.noStroke();
    sketch.fill(fade(getColor("BLACK"), 0.35));
    sketch.triangle(
      origin.x + 3,
      origin.y - size * 0.7 + 3,
      origin.x + size * 0.65 + 3,
      origin.y + size * 0.45 + 3,
      origin.x - size * 0.65 + 3,
      origin.y + size * 0.45 + 3
    );
    sketch.fill(PLOT_COLORS.fuchsia);
    sketch.triangle(
      origin.x,
      origin.y - size * 0.7,
      origin.x + size * 0.65,
      origin.y + size * 0.45,
      origin.x - size * 0.65,
      origin.y + size * 0.45
    );
    Arr.forEach(Arr.drop(spots, 1), (spot, index) => {
      sketch.noFill();
      sketch.stroke(RINGS[index] ?? PLOT_COLORS.pink);
      sketch.strokeWeight(3);
      sketch.circle(spot.x, spot.y, size * 2.6);
      sketch.noStroke();
      paintFlag(sketch, spot, size);
    });
    vignette(sketch, 0.28);
  };
}

interface OrienteeringMapVectorLabProps {
  description: ReactNode;
  labels: {
    angle: ReactNode;
    chooseView: string;
    east: ReactNode;
    north: ReactNode;
    size: ReactNode;
    viewLabel: string;
    views: Record<View, ReactNode>;
  };
  /** The checkpoints A, B and C, in metres east and north of the start O. */
  marks: Marks;
  title: ReactNode;
  /** The views the card offers, in order; every view when left out. */
  views?: readonly View[];
}

/**
 * An orienteering map of a city park with the start O (fuchsia triangle)
 * and the checkpoints A, B and C in teal, amber and pink rings. The learner switches what the map shows: the vector from A to
 * B, its opposite from B to A, the same vector drawn from C, or A to B as
 * the position of B minus the position of A. The card reads the components,
 * the length and the direction of the vector shown.
 */
export function OrienteeringMapVectorLab({
  description,
  labels,
  marks: given,
  title,
  views = ViewSchema.literals,
}: OrienteeringMapVectorLabProps) {
  const quantity = useQuantity();
  const marks = useMemo(() => Schema.decodeSync(MarksSchema)(given), [given]);
  const [view, setView] = useState<View>(views[0] ?? "forward");
  const isView = Schema.is(ViewSchema);
  const { vector } = shownVector(marks, view);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseView}
          gridColumns={views.length > 3 ? "4" : "3"}
          onValueChange={(value) => {
            if (isView(value)) {
              setView(value);
            }
          }}
          type="single"
          value={view}
          variant="outline"
        >
          {Arr.map(views, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.views[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={markProgram}
          state={{ marks, view }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.east}
            value={<InlineMath math={quantity(vector.east, "\\text{ m}", 1)} />}
          />
          <VisualFactTabular
            label={labels.north}
            value={
              <InlineMath math={quantity(vector.north, "\\text{ m}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.size}
            value={<InlineMath math={quantity(vector.size, "\\text{ m}", 1)} />}
          />
          <VisualFactTabular
            label={labels.angle}
            value={<InlineMath math={quantity(vector.angle, "^\\circ", 1)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
