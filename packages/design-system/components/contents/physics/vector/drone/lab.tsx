import type { Hop } from "@repo/design-system/components/contents/physics/vector/drone/flight";
import {
  displacement,
  HopsSchema,
  hopCorners,
  pathLength,
  scaleHops,
} from "@repo/design-system/components/contents/physics/vector/drone/flight";
import { DroneScene } from "@repo/design-system/components/contents/physics/vector/drone/scene";
import { unitForm } from "@repo/design-system/components/contents/physics/vector/form";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

interface DroneDisplacementLabProps {
  description: NonNullable<ReactNode>;
  /** Numbers the learner multiplies the flight plan by, when the card offers that choice. */
  factors?: readonly number[];
  /** The flight plan: legs in metres east, north and up. */
  hops: readonly [Hop, ...Hop[]];
  labels: {
    chooseFactor: string;
    displacement: ReactNode;
    path: ReactNode;
    size: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
  /** Whether the pad shows the unit vectors east, north and up. */
  units?: boolean;
}

/**
 * A drone takes off from a pad in a field and flies its plan leg by leg.
 * The violet arrow is its displacement from the pad, laid out as three
 * components tip to tail: east (teal), north (amber) and up (fuchsia). The
 * card writes the displacement with unit vectors, its length from all three
 * components, and the longer path the drone actually flew. With factors,
 * the learner multiplies the whole plan by a number.
 */
/** The direction the camera looks back along, from the flight toward the viewer. */
const VIEW = [-0.36, 0.2, 0.91] as const;

/** The room kept round the flight for the pad, the unit vectors and the drone, in metres. */
const MARGIN = { ground: 1.9, sky: 1.4 } as const;

/**
 * The camera that shows the whole flight: it looks at the middle of the box
 * round every corner of the path, the pad and the drone, from far enough
 * back for the box's tallest or widest side to fit.
 */
function flightView(hops: readonly [Hop, ...Hop[]]) {
  const corners = hopCorners(hops);
  const range = (read: (corner: Hop) => number) => {
    const values = Arr.map(corners, read);
    return {
      max: Math.max(MARGIN.ground, ...values),
      min: Math.min(-MARGIN.ground, ...values),
    };
  };
  const east = range((corner) => corner.east);
  const north = range((corner) => corner.north);
  const up = {
    max: Math.max(0, ...Arr.map(corners, (corner) => corner.up)) + MARGIN.sky,
    min: Math.min(0, ...Arr.map(corners, (corner) => corner.up)) - 0.5,
  };
  const span = Math.max(
    up.max - up.min,
    (east.max - east.min) * 0.75,
    (north.max - north.min) * 0.5
  );
  const target = [
    (east.min + east.max) / 2,
    (up.min + up.max) / 2,
    -(north.min + north.max) / 2,
  ] as const;
  const distance = span * 1.5;
  return {
    position: [
      target[0] + VIEW[0] * distance,
      target[1] + VIEW[1] * distance,
      target[2] + VIEW[2] * distance,
    ],
    target,
  } as const;
}

export function DroneDisplacementLab({
  description,
  factors = [],
  hops: plan,
  labels,
  title,
  units = false,
}: DroneDisplacementLabProps) {
  const quantity = useQuantity();
  const decoded = useMemo(() => Schema.decodeSync(HopsSchema)(plan), [plan]);
  const [factor, setFactor] = useState(1);
  const hops = scaleHops(decoded, factor);
  const moved = displacement(hops);
  const reach = Math.max(moved.size, 6);
  const view = flightView(hops);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      {Arr.isReadonlyArrayNonEmpty(factors) ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.chooseFactor}
            gridColumns={factors.length > 3 ? "4" : "3"}
            onValueChange={(value) => setFactor(Number(value))}
            type="single"
            value={String(factor)}
            variant="outline"
          >
            {Arr.map(factors, (option) => (
              <ToggleGroupItem key={option} value={String(option)}>
                <InlineMath math={`k=${quantity(option, "", 1)}`} />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      ) : null}
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="grass" reach={reach} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={view.position}
              cameraTarget={view.target}
              fov={40}
              maxDistance={reach * 4}
              minDistance={reach * 0.4}
            />
            <DroneScene hops={hops} units={units} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.displacement}
            value={
              <InlineMath
                math={`\\vec r=${unitForm(
                  [moved.east, moved.north, moved.up],
                  (value) => quantity(value, "", 1),
                  "\\text{ m}"
                )}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.size}
            value={<InlineMath math={quantity(moved.size, "\\text{ m}", 1)} />}
          />
          <VisualFactTabular
            label={labels.path}
            value={
              <InlineMath math={quantity(pathLength(hops), "\\text{ m}", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
