import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { AnimatedFlightBird } from "@repo/design-system/components/contents/biology/fauna";
import {
  buildFusiformBelly,
  useMuscleMaterials,
} from "@repo/design-system/components/contents/biology/limb/anatomy";
import {
  BarramundiFishOrganism,
  EarthwormOrganism,
} from "@repo/design-system/components/contents/biology/locomotion/creatures";
import { GrasshopperOrganism } from "@repo/design-system/components/contents/biology/locomotion/grasshopper";
import type {
  LocomotionAnimal,
  LocomotionMuscle,
  LocomotionPart,
} from "@repo/design-system/components/contents/biology/locomotion/model";
import { activeMuscleAt } from "@repo/design-system/components/contents/biology/locomotion/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr, Match } from "effect";
import { createContext, use, useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { ExtrudeGeometry, Shape } from "three";

const PartsContext = createContext<Readonly<
  Record<LocomotionPart, string>
> | null>(null);

function useLocomotionParts(): Readonly<Record<LocomotionPart, string>> {
  const value = use(PartsContext);
  if (value === null) {
    return {
      chaetae: "",
      femur: "",
      fin: "",
      fluid: "",
      keel: "",
      myotome: "",
      tibia: "",
    };
  }
  return value;
}

function LocomotionCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.78, 3.85] : [0, 1.42, 3.05]}
      cameraTarget={[0, 0.46, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

function EarthwormView({
  activeMuscle,
}: {
  readonly activeMuscle: LocomotionMuscle;
}) {
  const parts = useLocomotionParts();
  const ink = useLabelInk();
  return (
    <group>
      <EarthwormOrganism elongated={activeMuscle === "circular"} />
      <ThreeLabel color={ink} fontSize="compact" position={[0, 0.56, 0]}>
        <span>{parts.fluid}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.42, 0.14, 0.46]}>
        <span>{parts.chaetae}</span>
      </ThreeLabel>
    </group>
  );
}

function FishView({
  activeMuscle,
}: {
  readonly activeMuscle: LocomotionMuscle;
}) {
  const parts = useLocomotionParts();
  const ink = useLabelInk();
  return (
    <group>
      <BarramundiFishOrganism activeMuscle={activeMuscle} />
      <ThreeLabel color={ink} fontSize="compact" position={[0.14, 0.92, 0.24]}>
        <span>{parts.myotome}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.86, 0.82, 0]}>
        <span>{parts.fin}</span>
      </ThreeLabel>
    </group>
  );
}

function GrasshopperView({
  activeMuscle,
}: {
  readonly activeMuscle: LocomotionMuscle;
}) {
  const parts = useLocomotionParts();
  const ink = useLabelInk();
  return (
    <group>
      <GrasshopperOrganism kicking={activeMuscle === "extensor"} />
      <ThreeLabel color={ink} fontSize="compact" position={[-0.12, 1.02, 0.22]}>
        <span>{parts.femur}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.72, 0.34, 0.26]}>
        <span>{parts.tibia}</span>
      </ThreeLabel>
    </group>
  );
}

function BirdView({
  activeMuscle,
  playing,
}: {
  readonly activeMuscle: LocomotionMuscle;
  readonly playing: boolean;
}) {
  const parts = useLocomotionParts();
  const ink = useLabelInk();
  const mats = useMuscleMaterials();
  const downstroke = activeMuscle === "pectoralis";

  // Sculpted anatomical sternum keel (carina) blade + fusiform striated pectoralis sheets.
  const { keelGeo, pecGeo } = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-0.2, 0.03);
    shape.bezierCurveTo(-0.08, -0.065, 0.08, -0.075, 0.21, -0.005);
    shape.lineTo(0.17, 0.05);
    shape.lineTo(-0.2, 0.03);
    const keel = new ExtrudeGeometry(shape, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.006,
      bevelThickness: 0.006,
      depth: 0.016,
    });
    keel.translate(0, 0, -0.008);
    const pec = buildFusiformBelly(0.28, 0.056);
    pec.rotateZ(Math.PI / 2);
    return { keelGeo: keel, pecGeo: pec };
  }, []);

  useEffect(
    () => () => {
      keelGeo.dispose();
      pecGeo.dispose();
    },
    [keelGeo, pecGeo]
  );

  return (
    <group position={[0, 0.64, 0]}>
      {/* Real animated morph-target bird in crisp 3/4 flight profile */}
      <group rotation={[0.08, Math.PI * 0.36, 0]}>
        <AnimatedFlightBird
          color={SKELETON_COLORS.birdBody}
          playing={playing}
          poseTime={downstroke ? 0.16 : 0.56}
          sheenColor={SKELETON_COLORS.birdBreast}
          speed={1.15}
          targetExtent={2.12}
        />
      </group>

      {/* Ventral anatomical inset tucked cleanly along the sternum breast */}
      <group position={[0.02, -0.1, 0.02]} rotation={[0, 0.28, 0]}>
        <mesh castShadow geometry={keelGeo}>
          <meshPhysicalMaterial
            clearcoat={0.28}
            color={SKELETON_COLORS.keelBone}
            roughness={0.44}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            geometry={pecGeo}
            key={`pec-${side}`}
            material={downstroke ? mats.active : mats.relaxed}
            position={[0.01, 0.015, side * 0.036]}
            scale={downstroke ? [1.1, 0.92, 0.78] : [0.95, 0.72, 0.6]}
          />
        ))}
      </group>

      <ThreeLabel color={ink} fontSize="compact" position={[0.08, -0.34, 0.16]}>
        <span>{parts.keel}</span>
      </ThreeLabel>
    </group>
  );
}

export function LocomotionScene({
  activeMuscle,
  animal,
  onMuscleChange,
  parts,
}: {
  readonly activeMuscle: LocomotionMuscle;
  readonly animal: LocomotionAnimal;
  readonly onMuscleChange: (next: LocomotionMuscle) => void;
  readonly parts: Readonly<Record<LocomotionPart, string>>;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRef(0);
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current = (clock.current + simulationStep(delta) * 0.55) % 1;
    const next = activeMuscleAt(animal, clock.current);
    if (next !== activeMuscle) {
      onMuscleChange(next);
    }
  });

  return (
    <PartsContext value={parts}>
      <group ref={groupRef}>
        <SimulationTicker running={playing} />
        <LocomotionCamera />
        {Match.value(animal).pipe(
          Match.when("earthworm", () => (
            <EarthwormView activeMuscle={activeMuscle} />
          )),
          Match.when("fish", () => <FishView activeMuscle={activeMuscle} />),
          Match.when("grasshopper", () => (
            <GrasshopperView activeMuscle={activeMuscle} />
          )),
          Match.when("bird", () => (
            <BirdView activeMuscle={activeMuscle} playing={playing} />
          )),
          Match.exhaustive
        )}
      </group>
    </PartsContext>
  );
}
