import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  isSet,
  phAfter,
} from "@repo/design-system/components/contents/biology/bacteria/microbe";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import type { Group, Mesh, MeshPhysicalMaterial } from "three";

/** Eight hours in the yoghurt maker. */
const HOURS = 8;

/** Played, an hour passes in a second. */
const HOURS_PER_SECOND = 1;

/** The jar tilts this far when the learner tests whether the milk has set. */
const TILT = 0.6;

/**
 * Milk with a spoonful of yoghurt culture sits in a yoghurt maker at 43 °C.
 * Lactic acid bacteria turn the milk's sugar into lactic acid, so the pH
 * meter falls; when it reaches 4.6, casein loses its charge and the milk sets
 * into yoghurt. Tilting the jar shows it: liquid milk stays level, set
 * yoghurt tilts with the jar.
 */
export function YogurtLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly hours: string;
    readonly ph: ReactNode;
    readonly state: ReactNode;
    readonly states: Readonly<{ liquid: ReactNode; set: ReactNode }>;
    readonly tilt: string;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [hours, setHours] = useState(HOURS);
  const [tilted, setTilted] = useState(false);
  const quantity = useQuantity();

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.hours}</span>
            <span className="tabular-nums">
              {Math.floor(hours)}/{HOURS}
            </span>
          </div>
          <Slider
            aria-label={labels.hours}
            max={HOURS}
            min={0}
            onValueChange={setHours}
            step={0.25}
            value={hours}
          />
        </div>
        <ButtonGroup>
          <Button
            aria-pressed={tilted}
            onClick={() => setTilted((shown) => !shown)}
          >
            {labels.tilt}
          </Button>
        </ButtonGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.6} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.2, 0.32, 0.55]}
              cameraTarget={[0, 0.12, 0]}
              fov={32}
              maxDistance={1.4}
              minDistance={0.3}
            />
            <YogurtScene hours={hours} onHours={setHours} tilted={tilted} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.ph}
            value={<InlineMath math={quantity(phAfter(hours), "", 1)} />}
          />
          <VisualFactTabular
            label={labels.state}
            value={isSet(hours) ? labels.states.set : labels.states.liquid}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The yoghurt maker, the jar of milk and the pH meter. Played, the scene
 * moves the hours on and hands them to the card; the jar eases into its tilt.
 */
function YogurtScene({
  hours,
  onHours,
  tilted,
}: {
  readonly hours: number;
  readonly onHours: (hours: number) => void;
  readonly tilted: boolean;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const jar = useRef<Group>(null);
  const milk = useRef<Mesh>(null);
  const curd = useRef<MeshPhysicalMaterial>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const clock = useRef(hours);
  const sent = useRef(hours);
  const lean = useRef(0);
  const reading = useReading();
  const [rested, setRested] = useState(tilted);
  const easing = rested !== tilted;

  // An hour the learner set on the slider moves the clock; an hour the scene
  // sent while playing is already on it.
  useEffect(() => {
    if (hours !== sent.current) {
      clock.current = hours;
      sent.current = hours;
    }
  }, [hours]);

  useFrame((_, delta) => {
    if (playing) {
      clock.current =
        clock.current >= HOURS
          ? 0
          : Math.min(HOURS, clock.current + delta * HOURS_PER_SECOND);
      const quarter = Math.round(clock.current * 4) / 4;
      if (quarter !== sent.current) {
        sent.current = quarter;
        onHours(quarter);
      }
    }
    const time = clock.current;
    const target = tilted ? TILT : 0;
    lean.current += (target - lean.current) * Math.min(1, delta * 4);
    if (Math.abs(target - lean.current) < 0.002 && easing) {
      lean.current = target;
      setRested(tilted);
    }
    jar.current?.rotation.set(0, 0, lean.current);
    // Liquid milk stays level as the jar leans; set yoghurt leans with it.
    milk.current?.rotation.set(0, 0, isSet(time) ? 0 : -lean.current);
    if (curd.current) {
      const set = Math.min(1, Math.max(0, (6.2 - phAfter(time)) / 1.6));
      curd.current.roughness = 0.12 + 0.6 * set;
      curd.current.clearcoat = 1 - set;
    }
    if (meter.current) {
      meter.current.textContent = `pH ${reading(phAfter(time), 2)}`;
    }
  });

  return (
    <>
      <SimulationTicker running={playing || easing} />
      <LabBench />
      <RoundedBox
        args={[0.2, 0.06, 0.2]}
        castShadow
        position={[0, 0.03, 0]}
        radius={0.02}
      >
        <meshStandardMaterial color={MATERIAL.yogurtMaker} roughness={0.4} />
      </RoundedBox>
      <ThreeLabel
        color={getColor("GRAY", 800)}
        fontSize="compact"
        outlineColor={getColor("SLATE", 50)}
        outlineWidth={0.003}
        position={[0, 0.035, 0.105]}
      >
        43 °C
      </ThreeLabel>
      <group position={[0, 0.06, 0]} ref={jar}>
        <mesh castShadow position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.12, 40, 1, true]} />
          <GlassMaterial color={MATERIAL.glass} opacity={0.25} />
        </mesh>
        <mesh position={[0, 0.045, 0]} ref={milk}>
          <cylinderGeometry args={[0.042, 0.042, 0.088, 40]} />
          <meshPhysicalMaterial
            clearcoat={1}
            color={MATERIAL.milk}
            ref={curd}
            roughness={0.12}
          />
        </mesh>
        <mesh position={[0.02, 0.1, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.13, 12]} />
          <MetalMaterial color={MATERIAL.probeSteel} roughness={0.3} />
        </mesh>
      </group>
      <group position={[0.17, 0, 0.04]}>
        <RoundedBox
          args={[0.07, 0.11, 0.03]}
          castShadow
          position={[0, 0.055, 0]}
          radius={0.008}
        >
          <meshStandardMaterial color={MATERIAL.meterBody} roughness={0.5} />
        </RoundedBox>
        <ThreeLabel
          color={MATERIAL.meterInk}
          fontSize="compact"
          outlineColor={MATERIAL.meterHalo}
          outlineWidth={0.003}
          position={[0, 0.075, 0.017]}
        >
          <span className="font-mono tabular-nums" ref={meter} />
        </ThreeLabel>
      </group>
    </>
  );
}
