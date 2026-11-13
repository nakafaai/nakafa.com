import { useFrame, useThree } from "@react-three/fiber";
import {
  BUD_MINUTES,
  type CellKind,
  CellKindSchema,
  lengthOf,
  scaleBar,
} from "@repo/design-system/components/contents/biology/cell/anatomy";
import {
  AnimalCell,
  PlantCell,
} from "@repo/design-system/components/contents/biology/cell/eukaryote";
import {
  BacteriumCell,
  YeastCell,
} from "@repo/design-system/components/contents/biology/cell/microbe";
import {
  Sway,
  useLabelInk,
} from "@repo/design-system/components/contents/biology/cell/parts";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
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
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";

/** Played, a budding cycle of 90 minutes takes 15 seconds. */
const MINUTES_PER_SECOND = 6;

/** The bacterium stands a little smaller, so its flagellum fits the view. */
const ROD_SCALE = 0.8;

/**
 * A cell cut in half, so the reader looks into it as into a bowl: an animal
 * cell, a leaf cell, a baker's yeast cell or a bacterium, each with its parts
 * at their real sizes. The reader picks among `cells`; the scale bar and the
 * footer give the cell's real size and the traits that set its kingdom
 * apart. Played, the cell turns slowly, and a yeast cell grows its bud.
 */
export function CellCutawayLab({
  cells,
  description,
  labels,
  title,
}: {
  readonly cells: readonly CellKind[];
  readonly description: ReactNode;
  readonly labels: {
    readonly choose: string;
    readonly cells: Readonly<Partial<Record<CellKind, ReactNode>>>;
    readonly facts: Readonly<
      Partial<
        Record<
          CellKind,
          Readonly<{ nucleus: ReactNode; power: ReactNode; wall: ReactNode }>
        >
      >
    >;
    readonly minutes?: string;
    readonly nucleus: ReactNode;
    readonly power: ReactNode;
    readonly size: ReactNode;
    readonly viewLabel: string;
    readonly wall: ReactNode;
  };
  readonly title: ReactNode;
}) {
  const [kind, setKind] = useState<CellKind>(cells[0] ?? "animal");
  const [minutes, setMinutes] = useState(BUD_MINUTES * 0.7);
  const quantity = useQuantity();
  const facts = labels.facts[kind];
  const budding = kind === "yeast" && labels.minutes !== undefined;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {(cells.length > 1 || budding) && (
        <VisualCardToolbar>
          {cells.length > 1 && (
            <ToggleGroup
              aria-label={labels.choose}
              onValueChange={(value: string) => {
                if (Schema.is(CellKindSchema)(value)) {
                  setKind(value);
                }
              }}
              type="single"
              value={kind}
              variant="outline"
            >
              {Arr.map(cells, (each) => (
                <ToggleGroupItem key={each} value={each}>
                  {labels.cells[each]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          {budding && (
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span>{labels.minutes}</span>
                <span className="tabular-nums">
                  {Math.round(minutes)}/{BUD_MINUTES}
                </span>
              </div>
              <Slider
                aria-label={labels.minutes}
                max={BUD_MINUTES}
                min={0}
                onValueChange={setMinutes}
                step={1}
                value={minutes}
              />
            </div>
          )}
        </VisualCardToolbar>
      )}

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={-1.3} reach={2.2} setting="studio">
          <Suspense fallback={null}>
            <CutawayCamera />
            <CellScene kind={kind} minutes={minutes} onMinutes={setMinutes} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.size}
            value={
              <InlineMath
                math={quantity(lengthOf(kind), "\\,\\mu\\text{m}", 0)}
              />
            }
          />
          <VisualFactTabular label={labels.nucleus} value={facts?.nucleus} />
          <VisualFactTabular label={labels.wall} value={facts?.wall} />
          <VisualFactTabular label={labels.power} value={facts?.power} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The camera on the cut cell: farther back on a narrow card, such as a
 * phone's square frame, so a budding yeast cell and its bud fit whole.
 */
function CutawayCamera() {
  const size = useThree((state) => state.size);
  return (
    <CameraControls
      cameraPosition={
        isNarrowThreeScene(size, 1.2) ? [0.8, 1.4, 6.8] : [0.6, 1.05, 4.4]
      }
      cameraTarget={[0, -0.12, -0.3]}
      fov={34}
      maxDistance={9}
      minDistance={1.6}
    />
  );
}

/**
 * The cut cell on its stand with a scale bar under it. Played, the cell
 * sways; a yeast cell's clock runs and hands its minutes to the card.
 */
function CellScene({
  kind,
  minutes,
  onMinutes,
}: {
  readonly kind: CellKind;
  readonly minutes: number;
  readonly onMinutes: (minutes: number) => void;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(minutes);
  const sent = useRef(minutes);
  const quantity = useQuantity();
  const ink = useLabelInk();
  const length = lengthOf(kind);
  const bar = scaleBar(length);
  const barUnits = (bar / length) * 2 * (kind === "bacterium" ? ROD_SCALE : 1);

  useEffect(() => {
    if (minutes !== sent.current) {
      clock.current = minutes;
      sent.current = minutes;
    }
  }, [minutes]);

  useFrame((_, delta) => {
    if (!(playing && kind === "yeast")) {
      return;
    }
    clock.current =
      (clock.current + Math.min(delta, 0.1) * MINUTES_PER_SECOND) % BUD_MINUTES;
    const whole = Math.round(clock.current);
    if (whole !== sent.current) {
      sent.current = whole;
      onMinutes(whole);
    }
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <Sway playing={playing && kind !== "yeast"}>
        {kind === "animal" && <AnimalCell />}
        {kind === "plant" && <PlantCell />}
        {kind === "yeast" && <YeastCell minutes={minutes} />}
        {kind === "bacterium" && (
          <group
            position={[0.55, 0, 0]}
            scale={[ROD_SCALE, ROD_SCALE, ROD_SCALE]}
          >
            <BacteriumCell playing={playing} />
          </group>
        )}
      </Sway>
      <group position={[0, -1.12, 0.1]}>
        <mesh>
          <boxGeometry args={[barUnits, 0.025, 0.025]} />
          <meshStandardMaterial color={ink} roughness={0.5} />
        </mesh>
        <ThreeLabel color={ink} fontSize="compact" position={[0, -0.09, 0]}>
          <InlineMath math={quantity(bar, "\\,\\mu\\text{m}", 1)} />
        </ThreeLabel>
      </group>
    </>
  );
}
