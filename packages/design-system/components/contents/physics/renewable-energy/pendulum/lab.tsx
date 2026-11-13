import { PendulumScene } from "@repo/design-system/components/contents/physics/renewable-energy/pendulum/scene";
import {
  type Drag,
  DragSchema,
  START_ENERGY,
  simulateSwing,
  swingAt,
  swingEnergies,
} from "@repo/design-system/components/contents/physics/renewable-energy/pendulum/swing";
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";

/** The moment the facts read, in seconds after the release. */
const READ_TIME = 10;

/** The color of each store, shared by the chart and the facts. */
const STORE_COLORS = {
  heat: PLOT_COLORS.pink,
  kinetic: PLOT_COLORS.teal,
  potential: PLOT_COLORS.amber,
} as const;

interface PendulumEnergyLabProps {
  description: ReactNode;
  /** The drag the bob swings against first. */
  drag?: Drag;
  labels: {
    chooseDrag: string;
    drags: Record<Drag, ReactNode>;
    heat: ReactNode;
    kinetic: ReactNode;
    potential: ReactNode;
    start: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A 1 kg bob on a 2 m string, let go from 40°, beside a chart of its energy
 * stores. Without drag, potential and kinetic energy trade back and forth
 * forever. With drag, heat in the surroundings grows while the swing dies
 * down, and the three bands always stack to the same 4.59 J.
 */
export function PendulumEnergyLab({
  description,
  drag: initialDrag = "light",
  labels,
  title,
}: PendulumEnergyLabProps) {
  const [drag, setDrag] = useState<Drag>(initialDrag);
  const measure = useQuantity();
  const run = useMemo(() => simulateSwing(drag), [drag]);
  const read = swingEnergies(swingAt(run, READ_TIME));
  const isDrag = Schema.is(DragSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseDrag}
          gridColumns="3"
          onValueChange={(value) => {
            if (isDrag(value)) {
              setDrag(value);
            }
          }}
          type="single"
          value={drag}
          variant="outline"
        >
          {Arr.map(DragSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.drags[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[1.6, 1.8, 5.6]}
              cameraTarget={[0.7, 1.2, 0]}
              fov={38}
              maxDistance={8}
              minDistance={1.5}
            />
            <PendulumScene colors={STORE_COLORS} drag={drag} run={run} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.start}
            value={<InlineMath math={measure(START_ENERGY, "\\text{ J}", 2)} />}
          />
          <VisualFactIndicator
            indicatorColor={STORE_COLORS.potential}
            label={labels.potential}
            value={
              <InlineMath math={measure(read.potential, "\\text{ J}", 2)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={STORE_COLORS.kinetic}
            label={labels.kinetic}
            value={<InlineMath math={measure(read.kinetic, "\\text{ J}", 2)} />}
          />
          <VisualFactIndicator
            indicatorColor={STORE_COLORS.heat}
            label={labels.heat}
            value={<InlineMath math={measure(read.heat, "\\text{ J}", 2)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
