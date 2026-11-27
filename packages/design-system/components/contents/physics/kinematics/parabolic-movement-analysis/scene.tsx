import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  CANNON,
  Cannon,
  Shot,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/cannon";
import type {
  ProjectileMotionState,
  ProjectileScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import {
  getProjectileLoopSample,
  getProjectilePoint,
  PROJECTILE_SCENE,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import {
  Butt,
  Islet,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/islet";
import { Ocean } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/ocean";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group, Mesh, MeshBasicMaterial, PointLight } from "three";
import { CatmullRomCurve3, Vector2, Vector3 } from "three";

const PIRATE_COLORS = {
  flashCore: PLOT_COLORS.amber,
  flashOuter: PLOT_COLORS.orange,
  smoke: getColor("SLATE", 200),
} as const;

const BLAST_OUTER_PROFILE = Arr.map(
  [
    [0.001, 0],
    [0.14, 0.04],
    [0.21, 0.14],
    [0.17, 0.3],
    [0.08, 0.44],
    [0.001, 0.52],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

const BLAST_CORE_PROFILE = Arr.map(
  [
    [0.001, 0],
    [0.08, 0.03],
    [0.11, 0.1],
    [0.08, 0.2],
    [0.001, 0.29],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

const SMOKE_COUNT = 16;
const SMOKE_PUFFS = Array.from({ length: SMOKE_COUNT }, (_, index) => ({
  id: `smoke-${index}`,
  index,
}));

type VectorTuple = [number, number, number];

export function PirateProjectileScene({
  motion,
}: {
  motion: ProjectileMotionState;
}) {
  return (
    <group>
      <CameraBounds exclude>
        <Ocean motion={motion} />
      </CameraBounds>
      <StartIsland motion={motion} />
      <TargetIsland motion={motion} />
      <Trajectory motion={motion} />
      <GhostBalls motion={motion} />
      <AnimatedCannonBall motion={motion} />
      <CameraBounds exclude>
        <MuzzleBlast motion={motion} />
      </CameraBounds>
    </group>
  );
}

/** The battery: a sand islet with the gun on its crest, laid to the launch angle. */
function StartIsland({ motion }: { motion: ProjectileMotionState }) {
  return (
    <group>
      <CameraBounds exclude>
        <group position={[0.5, 0, 0]}>
          <Islet radius={1.6} seed={1.4} />
        </group>
      </CameraBounds>
      <group
        position={[
          PROJECTILE_SCENE.launchOffset[0],
          PROJECTILE_SCENE.launchOffset[1] - CANNON.trunnion,
          PROJECTILE_SCENE.launchOffset[2],
        ]}
      >
        <Cannon elevation={motion.angleRadians} />
      </group>
    </group>
  );
}

/** The range's far end: a second islet with the butt the shot comes down on. */
function TargetIsland({ motion }: { motion: ProjectileMotionState }) {
  const targetX = PROJECTILE_SCENE.launchOffset[0] + motion.rangeWorld;

  return (
    <group position={[targetX, 0, 0]}>
      <CameraBounds exclude>
        <group
          position={[
            0.2,
            PROJECTILE_SCENE.launchOffset[1] - CANNON.trunnion,
            0,
          ]}
        >
          <Islet radius={1.45} seed={3.2} />
        </group>
      </CameraBounds>
      <group position={[0.1, PROJECTILE_SCENE.launchOffset[1], 0]}>
        <Butt height={CANNON.trunnion} />
      </group>
    </group>
  );
}

function Trajectory({ motion }: { motion: ProjectileMotionState }) {
  const curve = useMemo(() => {
    const points = Array.from(
      { length: PROJECTILE_SCENE.trailSampleCount },
      (_, index) => {
        const progress = index / (PROJECTILE_SCENE.trailSampleCount - 1);
        const point = getProjectilePoint(motion, motion.flightTime * progress);

        return toScenePoint(point.x, point.y, 0);
      }
    );

    return new CatmullRomCurve3(points);
  }, [motion]);

  const peakPoint = getProjectilePoint(motion, motion.peakTime);

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 96, 0.014, 10, false]} />
        <meshBasicMaterial
          color={motion.scenario.color}
          opacity={0.9}
          transparent
        />
      </mesh>
      {/* Vertical apex height guide */}
      <Line
        color={motion.scenario.color}
        dashed
        dashSize={0.18}
        gapSize={0.12}
        lineWidth={2}
        opacity={0.55}
        points={[
          toSceneTuple(peakPoint.x, 0, 0),
          toSceneTuple(peakPoint.x, peakPoint.y, 0),
        ]}
        transparent
      />
    </group>
  );
}

/** The shot's past positions at equal time steps, as faded iron shot. */
function GhostBalls({ motion }: { motion: ProjectileMotionState }) {
  return (
    <group>
      {Arr.map(motion.ghostTimes, (time) => {
        const point = getProjectilePoint(motion, time);

        return (
          <group key={time} position={toSceneTuple(point.x, point.y, 0)}>
            <Shot faded />
          </group>
        );
      })}
    </group>
  );
}

function AnimatedCannonBall({ motion }: { motion: ProjectileMotionState }) {
  const ballRef = useRef<Group>(null);
  const { advance, time: simTime } = useSimulationClock(0);
  const scenarioRef = useRef<ProjectileScenarioId>(motion.scenario.id);

  useFrame((_, delta) => {
    if (!ballRef.current) {
      return;
    }

    if (scenarioRef.current !== motion.scenario.id) {
      scenarioRef.current = motion.scenario.id;
      simTime.current = 0;
    }

    const sample = getProjectileLoopSample(motion, advance(delta));
    const position = toSceneTuple(sample.point.x, sample.point.y, 0);

    ballRef.current.position.set(...position);
    ballRef.current.rotation.z = -sample.point.x * 2.3;
  });

  return (
    <CameraBounds
      motion={{
        rotation: "z",
        translation: {
          x: {
            min: PROJECTILE_SCENE.launchOffset[0],
            max: PROJECTILE_SCENE.launchOffset[0] + motion.rangeWorld,
          },
          y: {
            min: PROJECTILE_SCENE.launchOffset[1],
            max: PROJECTILE_SCENE.launchOffset[1] + motion.peakWorld,
          },
          z: {
            min: PROJECTILE_SCENE.launchOffset[2],
            max: PROJECTILE_SCENE.launchOffset[2],
          },
        },
      }}
      objectRef={ballRef}
    >
      <Shot />
    </CameraBounds>
  );
}

function MuzzleBlast({ motion }: { motion: ProjectileMotionState }) {
  const outerRef = useRef<MeshBasicMaterial>(null);
  const coreRef = useRef<MeshBasicMaterial>(null);
  const lightRef = useRef<PointLight>(null);
  const { advance, time: simTime } = useSimulationClock(0);
  const scenarioRef = useRef<ProjectileScenarioId>(motion.scenario.id);

  useFrame((_, delta) => {
    if (scenarioRef.current !== motion.scenario.id) {
      scenarioRef.current = motion.scenario.id;
      simTime.current = 0;
    }

    const { flashPower } = getProjectileLoopSample(motion, advance(delta));

    if (outerRef.current) {
      outerRef.current.opacity = flashPower * 0.68;
    }

    if (coreRef.current) {
      coreRef.current.opacity = flashPower * 0.92;
    }

    if (lightRef.current) {
      lightRef.current.intensity = flashPower * 1.6;
    }
  });

  return (
    <group
      position={toSceneTuple(
        Math.cos(motion.angleRadians) * CANNON.muzzle,
        Math.sin(motion.angleRadians) * CANNON.muzzle,
        0
      )}
      rotation={[0, 0, motion.angleRadians]}
    >
      <pointLight
        color={PIRATE_COLORS.flashOuter}
        distance={3.2}
        intensity={0}
        ref={lightRef}
      />
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <latheGeometry args={[BLAST_OUTER_PROFILE, 28]} />
        <meshBasicMaterial
          color={PIRATE_COLORS.flashOuter}
          depthWrite={false}
          opacity={0}
          ref={outerRef}
          transparent
        />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <latheGeometry args={[BLAST_CORE_PROFILE, 24]} />
        <meshBasicMaterial
          color={PIRATE_COLORS.flashCore}
          depthWrite={false}
          opacity={0}
          ref={coreRef}
          transparent
        />
      </mesh>
      <group>
        {Arr.map(SMOKE_PUFFS, (puff) => (
          <SmokePuff index={puff.index} key={puff.id} motion={motion} />
        ))}
      </group>
    </group>
  );
}

function SmokePuff({
  index,
  motion,
}: {
  index: number;
  motion: ProjectileMotionState;
}) {
  const puffRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const { advance, time: simTime } = useSimulationClock(0);
  const scenarioRef = useRef<ProjectileScenarioId>(motion.scenario.id);

  useFrame((_, delta) => {
    if (!(puffRef.current && materialRef.current)) {
      return;
    }

    if (scenarioRef.current !== motion.scenario.id) {
      scenarioRef.current = motion.scenario.id;
      simTime.current = 0;
    }

    const phase = (advance(delta) * 0.95 + index / SMOKE_COUNT) % 1;
    const drift = phase * 0.95;
    const spread = Math.sin(index * 1.9) * phase * 0.28;

    puffRef.current.position.set(drift * 0.7, phase * 0.22, spread);
    puffRef.current.scale.setScalar(0.08 + phase * 0.32);
    materialRef.current.opacity = (1 - phase) * 0.2;
  });

  return (
    <mesh ref={puffRef}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial
        color={PIRATE_COLORS.smoke}
        depthWrite={false}
        opacity={0}
        ref={materialRef}
        transparent
      />
    </mesh>
  );
}

function toScenePoint(x: number, y: number, z: number) {
  return new Vector3(...toSceneTuple(x, y, z));
}

function toSceneTuple(x: number, y: number, z: number): VectorTuple {
  return [
    PROJECTILE_SCENE.launchOffset[0] + x,
    PROJECTILE_SCENE.launchOffset[1] + y,
    PROJECTILE_SCENE.launchOffset[2] + z,
  ];
}
