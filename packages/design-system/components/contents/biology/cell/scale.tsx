import { useFrame } from "@react-three/fiber";
import {
  focusAt,
  LINEUP,
  SIZES,
  viewWidth,
} from "@repo/design-system/components/contents/biology/cell/anatomy";
import { AnimalCell } from "@repo/design-system/components/contents/biology/cell/eukaryote";
import { BacteriumCell } from "@repo/design-system/components/contents/biology/cell/microbe";
import { Virion } from "@repo/design-system/components/contents/biology/virus/envelope";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  useVisualScene,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { getColor } from "@repo/design-system/lib/color";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import type { Group } from "three";

/** The width of the view the scene draws, in scene units, whatever the zoom. */
const VIEW_UNITS = 3.4;

/** Played, the zoom runs in and back out over 16 seconds. */
const ZOOM_SECONDS = 8;

/**
 * An animal cell, an Escherichia coli rod and a SARS-CoV-2 virion side by
 * side at their real sizes: 20 µm, 2 µm and 0.1 µm. The slider zooms from the
 * whole cell, 50 µm across, down to the virion, 0.25 µm across, with each
 * step narrowing the view by the same factor, as a microscope's objectives
 * do; the footer reads out the view's width and the three sizes.
 */
export function CellScaleLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly bacterium: ReactNode;
    readonly cell: ReactNode;
    readonly view: ReactNode;
    readonly viewLabel: string;
    readonly virion: ReactNode;
    readonly zoom: string;
  };
  readonly title: ReactNode;
}) {
  const [zoom, setZoom] = useState(0);
  const quantity = useQuantity();
  const micro = "\\,\\mu\\text{m}";

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.zoom}</span>
            <span className="tabular-nums">
              {Math.round(50 / viewWidth(zoom))}×
            </span>
          </div>
          <Slider
            aria-label={labels.zoom}
            max={1}
            min={0}
            onValueChange={setZoom}
            step={0.01}
            value={zoom}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={2} setting="studio">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0, 0.5, 3.8]}
              cameraTarget={[0, 0, 0]}
              enablePan={false}
              enableZoom={false}
              fov={34}
            />
            <LineupScene labels={labels} onZoom={setZoom} zoom={zoom} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.view}
            value={<InlineMath math={quantity(viewWidth(zoom), micro, 2)} />}
          />
          <VisualFactTabular
            label={labels.cell}
            value={<InlineMath math={quantity(SIZES.cell, micro, 0)} />}
          />
          <VisualFactTabular
            label={labels.bacterium}
            value={<InlineMath math={quantity(SIZES.bacterium, micro, 0)} />}
          />
          <VisualFactTabular
            label={labels.virion}
            value={<InlineMath math={quantity(SIZES.virion, micro, 1)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The three bodies in a row, in micrometres. The scene scales and shifts the
 * row so the view always shows `viewWidth(zoom)` micrometres around the
 * zoom's focus; played, it runs the zoom in and out.
 */
function LineupScene({
  labels,
  onZoom,
  zoom,
}: {
  readonly labels: Readonly<{
    bacterium: ReactNode;
    cell: ReactNode;
    virion: ReactNode;
  }>;
  readonly onZoom: (zoom: number) => void;
  readonly zoom: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const row = useRef<Group>(null);
  const clock = useRef(0);
  const shown = useRef(zoom);
  const sent = useRef(zoom);

  useEffect(() => {
    if (zoom !== sent.current) {
      shown.current = zoom;
      sent.current = zoom;
    }
  }, [zoom]);

  useFrame((_, delta) => {
    if (playing) {
      clock.current += Math.min(delta, 0.1);
      const phase = (clock.current / ZOOM_SECONDS) % 2;
      shown.current = phase < 1 ? phase : 2 - phase;
      const step = Math.round(shown.current * 100) / 100;
      if (step !== sent.current) {
        sent.current = step;
        onZoom(step);
      }
    }
    const width = viewWidth(shown.current);
    const scale = VIEW_UNITS / width;
    row.current?.scale.setScalar(scale);
    row.current?.position.set(-focusAt(width) * scale, 0, 0);
  });

  const ink = getColor("ZINC", 900);
  const halo = getColor("SLATE", 50);
  // A label shows only while its body is large enough on screen to point at.
  const width = viewWidth(zoom);

  return (
    <>
      <SimulationTicker running={playing} />
      <group ref={row}>
        <group position={[LINEUP.cell, 0, 0]} scale={[10, 10, 10]}>
          <AnimalCell />
        </group>
        <group position={[LINEUP.bacterium, 0, 0]}>
          <BacteriumCell playing={playing} />
        </group>
        <group position={[LINEUP.virion, 0, 0]} scale={[0.05, 0.05, 0.05]}>
          <Virion />
        </group>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          outlineColor={halo}
          outlineWidth={0.004}
          position={[LINEUP.cell, -11, 0]}
          visible={width >= 12}
        >
          {labels.cell}
        </ThreeLabel>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          outlineColor={halo}
          outlineWidth={0.004}
          position={[LINEUP.bacterium, -0.9, 0]}
          visible={width <= 16 && width >= 1}
        >
          {labels.bacterium}
        </ThreeLabel>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          outlineColor={halo}
          outlineWidth={0.004}
          position={[LINEUP.virion, -0.09, 0]}
          visible={width <= 1.6}
        >
          {labels.virion}
        </ThreeLabel>
      </group>
    </>
  );
}
