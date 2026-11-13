import { useFrame, useThree } from "@react-three/fiber";
import {
  blockedChance,
  boundSpikes,
  isBlocked,
  levelOnDay,
  occupancyOf,
} from "@repo/design-system/components/contents/biology/virus/binding";
import { Virion } from "@repo/design-system/components/contents/biology/virus/envelope";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { type ReactNode, Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** The virions drifting toward the cell. */
const VIRIONS = 6;

/** A vaccinated person's antibody level in the card, in nM, at its peak. */
const VACCINATED = 12;

/** Played, the virions take six seconds to reach the cell and rest there a while. */
const FALL_SECONDS = 6;

/** The cell's surface is a sphere 3 µm across, drawn at 50 nm per unit. */
const CELL_RADIUS = 60;

/**
 * SARS-CoV-2 virions about 100 nm across drift down to a cell whose surface
 * carries ACE2 receptors. Antibodies in the blood bind the virions' spikes;
 * a virion with three quarters of its spikes covered cannot dock and drifts
 * away. In `vaccine` mode the reader compares an unvaccinated and a
 * vaccinated person; in `days` mode a slider counts the days after a vaccine
 * dose while the antibody level rises.
 */
export function AntibodyNeutralizeLab({
  description,
  labels,
  mode,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly blocked: ReactNode;
    readonly chance: ReactNode;
    readonly choose?: string;
    readonly covered: ReactNode;
    readonly day?: string;
    readonly level: ReactNode;
    readonly people?: Readonly<{
      unvaccinated: ReactNode;
      vaccinated: ReactNode;
    }>;
    readonly viewLabel: string;
  };
  readonly mode: "days" | "vaccine";
  readonly title: ReactNode;
}) {
  const [vaccinated, setVaccinated] = useState(true);
  const [day, setDay] = useState(14);
  const quantity = useQuantity();
  const reading = useReading();
  const level = antibodyLevel(mode, vaccinated, day);
  const share = occupancyOf(level);
  const virions = useMemo(
    () =>
      Arr.map(Arr.range(0, VIRIONS - 1), (id) => ({
        bound: boundSpikes(id, share),
        id,
      })),
    [share]
  );
  const blocked = Arr.length(
    Arr.filter(virions, ({ bound }) => isBlocked(bound))
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        {mode === "vaccine" && labels.people && (
          <ToggleGroup
            aria-label={labels.choose}
            onValueChange={(value: string) =>
              setVaccinated(value !== "unvaccinated")
            }
            type="single"
            value={vaccinated ? "vaccinated" : "unvaccinated"}
            variant="outline"
          >
            <ToggleGroupItem value="unvaccinated">
              {labels.people.unvaccinated}
            </ToggleGroupItem>
            <ToggleGroupItem value="vaccinated">
              {labels.people.vaccinated}
            </ToggleGroupItem>
          </ToggleGroup>
        )}
        {mode === "days" && (
          <div className="flex min-w-48 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span>{labels.day}</span>
              <span className="tabular-nums">{reading(day, 0)}/28</span>
            </div>
            <Slider
              aria-label={labels.day}
              max={28}
              min={0}
              onValueChange={setDay}
              step={1}
              value={day}
            />
          </div>
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={6} setting="studio">
          <Suspense fallback={null}>
            <DockingCamera />
            <DockingScene virions={virions} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.level}
            value={<InlineMath math={quantity(level, "\\text{ nM}", 1)} />}
          />
          <VisualFactTabular
            label={labels.covered}
            value={<InlineMath math={quantity(share * 100, "\\%", 0)} />}
          />
          <VisualFactTabular
            label={labels.blocked}
            value={<InlineMath math={`${blocked}/${VIRIONS}`} />}
          />
          <VisualFactTabular
            label={labels.chance}
            value={
              <InlineMath
                math={quantity(blockedChance(share) * 100, "\\%", 0)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The camera on the cell's surface: farther back on a narrow card, such as a
 * phone's square frame, so all six virions stay in view.
 */
function DockingCamera() {
  const size = useThree((state) => state.size);
  return (
    <CameraControls
      cameraPosition={
        isNarrowThreeScene(size, 1.2) ? [0, 4.5, 24] : [0, 3.5, 13]
      }
      cameraTarget={isNarrowThreeScene(size, 1.2) ? [0, 2, 0] : [0, 0.5, 0]}
      fov={36}
      maxDistance={34}
      minDistance={5}
    />
  );
}

/** The antibody level the card shows, in nM. */
function antibodyLevel(
  mode: "days" | "vaccine",
  vaccinated: boolean,
  day: number
) {
  if (mode === "days") {
    return levelOnDay(day);
  }
  return vaccinated ? VACCINATED : 0;
}

/**
 * The cell's surface with its receptors and the virions above it. Played,
 * every virion drifts down; a free one docks on a receptor, a blocked one
 * bounces off and drifts away.
 */
function DockingScene({
  virions,
}: {
  readonly virions: readonly Readonly<{
    bound: readonly boolean[];
    id: number;
  }>[];
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(FALL_SECONDS);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current += Math.min(delta, 0.1);
    if (clock.current > FALL_SECONDS + 3) {
      clock.current = 0;
    }
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <mesh position={[0, -CELL_RADIUS, 0]} receiveShadow>
        <sphereGeometry args={[CELL_RADIUS, 96, 48]} />
        <meshPhysicalMaterial color={MATERIAL.membrane} roughness={0.55} />
      </mesh>
      {Arr.map(Arr.range(0, 39), (receptor) => (
        <Receptor index={receptor} key={receptor} />
      ))}
      {Arr.map(virions, ({ bound, id }) => (
        <FallingVirion bound={bound} clock={clock} index={id} key={id} />
      ))}
    </>
  );
}

/** An ACE2 receptor standing on the cell: a stalk with a rounded head. */
function Receptor({ index }: { readonly index: number }) {
  return (
    <group
      position={[
        (hashUnit(index, 7) - 0.5) * 18,
        0,
        (hashUnit(index, 8) - 0.5) * 6,
      ]}
    >
      <mesh castShadow position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.24, 8]} />
        <meshStandardMaterial color={MATERIAL.receptor} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 0.3, 0]} scale={[1, 0.7, 1]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshStandardMaterial color={MATERIAL.receptor} roughness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * Virion `index` on its way down at the time `clock` holds: a free virion
 * settles on the cell, a blocked one dips toward it and drifts back up.
 */
function FallingVirion({
  bound,
  clock,
  index,
}: {
  readonly bound: readonly boolean[];
  readonly clock: Readonly<{ current: number }>;
  readonly index: number;
}) {
  const group = useRef<Group>(null);
  const blocked = isBlocked(bound);

  useFrame(() => {
    if (!group.current) {
      return;
    }
    const fall = Math.min(1, clock.current / FALL_SECONDS);
    const start = 4 + hashUnit(index, 2) * 1.5;
    const height = blocked
      ? start - 2.2 * Math.sin(Math.PI * fall * 0.9)
      : start + (1.45 - start) * fall * fall;
    group.current.position.set(
      (index - (VIRIONS - 1) / 2) * 2.8 + (blocked ? fall * 0.8 : 0),
      height,
      (hashUnit(index, 3) - 0.5) * 2
    );
    group.current.rotation.y = clock.current * 0.3 + index;
  });

  return (
    <group ref={group}>
      <Virion bound={bound} />
    </group>
  );
}
