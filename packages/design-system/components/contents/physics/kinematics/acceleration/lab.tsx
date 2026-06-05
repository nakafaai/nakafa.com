"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  ACCELERATION_CASES,
  ACCELERATION_LAB_SCENE,
  ACCELERATION_ROCKET_MODEL_PATH,
  type AccelerationCaseId,
  type AccelerationLabProps,
  type AccelerationMotionState,
  DEFAULT_ACCELERATION_CASE_ID,
  formatAccelerationMath,
  formatMeterPerSecondMath,
  formatSecondMath,
  getAccelerationLoopTime,
  getAccelerationMotionState,
  getAccelerationPositionSample,
  isAccelerationCaseId,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { getColor } from "@repo/design-system/lib/color";
import { type ReactNode, Suspense, useMemo, useRef, useState } from "react";
import {
  BackSide,
  Box3,
  type Group,
  Mesh,
  MeshStandardMaterial,
  type PointLight,
  Vector3,
} from "three";

const SPACE_COLORS = {
  atmosphere: getColor("SKY", 400),
  flameCore: getColor("YELLOW"),
  flameOuter: getColor("ORANGE", 500),
  planet: getColor("TEAL", 700),
  planetShadow: getColor("SLATE", 900),
  rocketAccent: getColor("ORANGE", 500),
  rocketBody: getColor("ZINC", 100),
  rocketDark: getColor("SLATE", 600),
  rocketEngine: getColor("STONE", 600),
  rocketFairing: getColor("ZINC", 100),
  rocketWing: getColor("SLATE", 300),
  smoke: getColor("SLATE", 200),
  space: getColor("ZINC", 950),
  star: getColor("WHITE"),
} as const;

const SPACE_ROCK_COUNT = 18;
const SPEED_PARTICLE_COUNT = 56;
const STAR_COUNT = 90;
const SMOKE_PARTICLE_COUNT = 18;
const SMOKE_PARTICLES = Array.from(
  { length: SMOKE_PARTICLE_COUNT },
  (_, index) => ({
    id: `smoke-${index}`,
    index,
  })
);
const ROCKET_MODEL_ROTATION_Y = Math.PI / 2;
const ROCKET_NOZZLE_MESH_NAME = "nozzle_cap";

type VectorTuple = [number, number, number];

interface RocketAsset {
  exhaust: RocketExhaust;
  rocket: Group;
}

interface RocketExhaust {
  anchor: VectorTuple;
  radius: number;
}

export function AccelerationLab({
  title,
  description,
  labels,
}: AccelerationLabProps) {
  const [caseId, setCaseId] = useState<AccelerationCaseId>(
    DEFAULT_ACCELERATION_CASE_ID
  );
  const motion = useMemo(() => getAccelerationMotionState(caseId), [caseId]);
  const facts = [
    {
      id: "initial-velocity",
      label: labels.factLabels.initialVelocity,
      value: (
        <InlineMath
          math={`v_0=${formatMeterPerSecondMath(motion.scenario.v0)}`}
        />
      ),
    },
    {
      id: "acceleration",
      indicatorColor: motion.scenario.color,
      label: labels.factLabels.acceleration,
      value: (
        <InlineMath math={`a=${formatAccelerationMath(motion.acceleration)}`} />
      ),
    },
    {
      id: "final-velocity",
      label: labels.factLabels.finalVelocity,
      value: (
        <InlineMath
          math={`v_t=${formatMeterPerSecondMath(motion.scenario.v1)}`}
        />
      ),
    },
    {
      id: "time-step",
      label: labels.factLabels.timeStep,
      value: <InlineMath math={`\\Delta t=${formatSecondMath(1)}`} />,
    },
  ];

  function handleCaseChange(value: string) {
    if (!isAccelerationCaseId(value)) {
      return;
    }

    setCaseId(value);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseCase}
          gridColumns="3"
          onValueChange={handleCaseChange}
          type="single"
          value={caseId}
          variant="outline"
        >
          {ACCELERATION_CASES.map((scenario) => (
            <ToggleGroupItem key={scenario.id} value={scenario.id}>
              {labels.scenarioNames[scenario.id]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas frameloop="always">
            <Suspense>
              <ambientLight intensity={0.42} />
              <hemisphereLight
                color={getColor("SLATE", 50)}
                groundColor={getColor("ZINC", 950)}
                intensity={0.55}
              />
              <directionalLight
                castShadow
                intensity={1.35}
                position={[-2.6, 4.6, 3.8]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <CameraControls
                autoRotate={false}
                cameraPosition={ACCELERATION_LAB_SCENE.cameraPosition}
                cameraTarget={ACCELERATION_LAB_SCENE.cameraTarget}
                enablePan
                enableRotate
                enableZoom
                fov={ACCELERATION_LAB_SCENE.cameraFov}
                maxDistance={12}
                minDistance={2.4}
              />
              <SpaceFlightScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {facts.map((fact) => (
            <LabFact
              indicatorColor={
                "indicatorColor" in fact ? fact.indicatorColor : undefined
              }
              key={fact.id}
              label={fact.label}
              value={fact.value}
            />
          ))}
        </dl>
      </CardFooter>
    </Card>
  );
}

function SpaceFlightScene({ motion }: { motion: AccelerationMotionState }) {
  const worldRef = useRef<Group>(null);
  const rocketRef = useRef<Group>(null);
  const startRef = useRef<number | null>(null);
  const caseRef = useRef<AccelerationCaseId | null>(null);

  useFrame((state) => {
    if (!(worldRef.current && rocketRef.current)) {
      return;
    }

    if (startRef.current === null || caseRef.current !== motion.scenario.id) {
      caseRef.current = motion.scenario.id;
      startRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startRef.current;
    const time = getAccelerationLoopTime(motion, elapsed);
    const sample = getAccelerationPositionSample(
      motion.scenario,
      time,
      motion.startX
    );

    const heading = getRocketHeading(motion.acceleration);

    worldRef.current.position.x =
      ACCELERATION_LAB_SCENE.rocketPosition[0] - sample.x;
    rocketRef.current.rotation.y = heading + Math.sin(elapsed * 1.8) * 0.025;
    rocketRef.current.rotation.z =
      motion.acceleration * -0.015 + Math.sin(elapsed * 2.4) * 0.018;
  });

  return (
    <group>
      <SpaceDome />
      <group ref={worldRef}>
        <DistantPlanet />
        <StarField length={motion.sceneLength} />
        <SpaceRocks length={motion.sceneLength} />
        <SpeedParticles length={motion.sceneLength} />
        <TimeGates motion={motion} />
      </group>
      <group
        position={ACCELERATION_LAB_SCENE.rocketPosition}
        ref={rocketRef}
        scale={ACCELERATION_LAB_SCENE.rocketScale}
      >
        <RocketShip
          flameDirection={getEngineFlameDirection(motion.acceleration)}
        />
      </group>
    </group>
  );
}

function SpaceDome() {
  return (
    <mesh>
      <sphereGeometry args={[28, 48, 32]} />
      <meshBasicMaterial color={SPACE_COLORS.space} side={BackSide} />
    </mesh>
  );
}

function DistantPlanet() {
  return (
    <group position={[8.2, -3.1, -9.2]} rotation={[0.3, 0.2, -0.25]}>
      <mesh>
        <sphereGeometry args={[1.12, 32, 20]} />
        <meshStandardMaterial color={SPACE_COLORS.planet} roughness={0.72} />
      </mesh>
      <mesh position={[-0.18, -0.08, -0.1]} scale={[1.02, 1.02, 1.02]}>
        <sphereGeometry args={[1.12, 32, 20]} />
        <meshBasicMaterial
          color={SPACE_COLORS.planetShadow}
          opacity={0.28}
          transparent
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.55, 0.018, 8, 96]} />
        <meshBasicMaterial
          color={SPACE_COLORS.atmosphere}
          opacity={0.36}
          transparent
        />
      </mesh>
    </group>
  );
}

function StarField({ length }: { length: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, index) => {
        const progress = index / (STAR_COUNT - 1);
        const angle = index * 2.399_963_229_728_653;
        const radius = 3.2 + (index % 9) * 0.42;
        return {
          id: `star-${index}`,
          scale: 0.014 + (index % 5) * 0.006,
          x: -length / 2 - 3 + progress * (length + 6),
          y: Math.sin(angle) * radius,
          z: Math.cos(angle) * radius,
        };
      }),
    [length]
  );

  return (
    <group>
      {stars.map((star) => (
        <mesh key={star.id} position={[star.x, star.y, star.z]}>
          <sphereGeometry args={[star.scale, 8, 8]} />
          <meshBasicMaterial color={SPACE_COLORS.star} />
        </mesh>
      ))}
    </group>
  );
}

function SpaceRocks({ length }: { length: number }) {
  const rocks = useMemo(
    () =>
      Array.from({ length: SPACE_ROCK_COUNT }, (_, index) => {
        const progress = (index + 0.5) / SPACE_ROCK_COUNT;
        const angle = index * 1.847;
        const radius = 1.9 + (index % 6) * 0.34;

        return {
          id: `rock-${index}`,
          radius: 0.06 + (index % 4) * 0.025,
          rotation: [index * 0.31, index * 0.47, index * 0.19] as const,
          x: -length / 2 + progress * length,
          y: Math.sin(angle) * radius,
          z: Math.cos(angle) * radius,
        };
      }),
    [length]
  );

  return (
    <group>
      {rocks.map((rock) => (
        <mesh
          key={rock.id}
          position={[rock.x, rock.y, rock.z]}
          rotation={rock.rotation}
        >
          <icosahedronGeometry args={[rock.radius, 1]} />
          <meshStandardMaterial
            color={SPACE_COLORS.rocketDark}
            roughness={0.82}
          />
        </mesh>
      ))}
    </group>
  );
}

function SpeedParticles({ length }: { length: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: SPEED_PARTICLE_COUNT }, (_, index) => {
        const progress = index / (SPEED_PARTICLE_COUNT - 1);
        const angle = index * 1.231;
        const radius = 0.95 + (index % 5) * 0.32;
        return {
          id: `speed-particle-${index}`,
          opacity: 0.18 + (index % 4) * 0.06,
          size: 0.18 + (index % 3) * 0.08,
          x: -length / 2 + progress * length,
          y: Math.sin(angle) * radius,
          z: Math.cos(angle) * radius,
        };
      }),
    [length]
  );

  return (
    <group>
      {particles.map((particle) => (
        <mesh key={particle.id} position={[particle.x, particle.y, particle.z]}>
          <boxGeometry args={[particle.size, 0.01, 0.01]} />
          <meshBasicMaterial
            color={SPACE_COLORS.atmosphere}
            opacity={particle.opacity}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function TimeGates({ motion }: { motion: AccelerationMotionState }) {
  return (
    <group>
      {motion.samples.map((sample) => (
        <mesh
          key={sample.time}
          position={[sample.x, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <torusGeometry
            args={[ACCELERATION_LAB_SCENE.gateRadius, 0.015, 10, 64]}
          />
          <meshBasicMaterial
            color={motion.scenario.color}
            opacity={0.26}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function RocketShip({ flameDirection }: { flameDirection?: -1 | 1 }) {
  const { scene } = useGLTF(ACCELERATION_ROCKET_MODEL_PATH);
  const asset = useMemo(() => createRocketAsset(scene), [scene]);

  return (
    <group>
      <PegasusRocketModel rocket={asset.rocket} />
      {flameDirection ? (
        <AnimatedExhaust direction={flameDirection} exhaust={asset.exhaust} />
      ) : null}
    </group>
  );
}

function PegasusRocketModel({ rocket }: { rocket: Group }) {
  return (
    <group rotation={[0, ROCKET_MODEL_ROTATION_Y, 0]}>
      <primitive object={rocket} />
    </group>
  );
}

function createRocketAsset(scene: Group): RocketAsset {
  const rocketMaterials = createRocketMaterials();
  const sceneBox = new Box3().setFromObject(scene);
  const center = sceneBox.getCenter(new Vector3());
  const clone = scene.clone(true);

  clone.position.sub(center);
  clone.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
    child.material = getRocketMaterial(child.name, rocketMaterials);
  });

  return {
    exhaust: getRocketExhaust(scene, sceneBox, center),
    rocket: clone,
  };
}

function createRocketMaterials() {
  return {
    accent: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketAccent,
      metalness: 0.18,
      roughness: 0.42,
    }),
    body: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketBody,
      metalness: 0.12,
      roughness: 0.36,
    }),
    dark: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketDark,
      metalness: 0.2,
      roughness: 0.52,
    }),
    engine: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketEngine,
      metalness: 0.44,
      roughness: 0.34,
    }),
    fairing: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketFairing,
      metalness: 0.1,
      roughness: 0.28,
    }),
    wing: new MeshStandardMaterial({
      color: SPACE_COLORS.rocketWing,
      metalness: 0.18,
      roughness: 0.42,
    }),
  } as const;
}

function getRocketMaterial(
  meshName: string,
  materials: ReturnType<typeof createRocketMaterials>
) {
  if (meshName.includes("fairing")) {
    return materials.fairing;
  }

  if (meshName.includes("nozzle")) {
    return materials.engine;
  }

  if (meshName === "_root") {
    return materials.body;
  }

  if (meshName.includes("stage_01")) {
    return materials.body;
  }

  if (meshName.includes("stage_03")) {
    return materials.dark;
  }

  if (meshName.includes("stage_02")) {
    return materials.accent;
  }

  return materials.accent;
}

function getRocketExhaust(
  scene: Group,
  sceneBox: Box3,
  center: Vector3
): RocketExhaust {
  const nozzle = scene.getObjectByName(ROCKET_NOZZLE_MESH_NAME);

  if (!nozzle) {
    const fallbackPoint = new Vector3(center.x, center.y, sceneBox.min.z);
    const fallbackSize = sceneBox.getSize(new Vector3());

    return {
      anchor: rotateCenteredRocketPoint(fallbackPoint, center),
      radius: Math.min(fallbackSize.x, fallbackSize.y) / 2,
    };
  }

  const nozzleBox = new Box3().setFromObject(nozzle);
  const nozzleCenter = nozzleBox.getCenter(new Vector3());
  const nozzleSize = nozzleBox.getSize(new Vector3());

  return {
    anchor: rotateCenteredRocketPoint(nozzleCenter, center),
    radius: Math.max(nozzleSize.x, nozzleSize.y) / 2,
  };
}

function rotateCenteredRocketPoint(
  point: Vector3,
  center: Vector3
): VectorTuple {
  const localPoint = point.clone().sub(center);
  const rotationCos = Math.cos(ROCKET_MODEL_ROTATION_Y);
  const rotationSin = Math.sin(ROCKET_MODEL_ROTATION_Y);

  return [
    localPoint.x * rotationCos + localPoint.z * rotationSin,
    localPoint.y,
    -localPoint.x * rotationSin + localPoint.z * rotationCos,
  ];
}

function AnimatedExhaust({
  direction,
  exhaust,
}: {
  direction: -1 | 1;
  exhaust: RocketExhaust;
}) {
  const flameRef = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);
  const lightRef = useRef<PointLight>(null);
  const flameRadius = exhaust.radius * 1.75;
  const flameLength = exhaust.radius * 7.4;
  const coreRadius = exhaust.radius * 0.72;
  const coreLength = exhaust.radius * 4.2;
  const flameOffset = flameLength / 2 + exhaust.radius * 0.45;
  const coreOffset = coreLength / 2 + exhaust.radius * 0.32;

  useFrame(({ clock }) => {
    const pulse = 0.86 + Math.sin(clock.elapsedTime * 18) * 0.14;
    flameRef.current?.scale.set(1, pulse, 1);
    coreRef.current?.scale.set(1, 0.86 + pulse * 0.14, 1);

    if (lightRef.current) {
      lightRef.current.intensity = 0.78 + pulse * 0.48;
    }
  });

  return (
    <group
      position={exhaust.anchor}
      rotation={[0, 0, direction > 0 ? -Math.PI / 2 : Math.PI / 2]}
    >
      <pointLight
        color={SPACE_COLORS.flameOuter}
        distance={exhaust.radius * 22}
        intensity={1}
        ref={lightRef}
      />
      <mesh position={[0, flameOffset, 0]} ref={flameRef}>
        <coneGeometry args={[flameRadius, flameLength, 32]} />
        <meshBasicMaterial
          color={SPACE_COLORS.flameOuter}
          depthWrite={false}
          opacity={0.68}
          transparent
        />
      </mesh>
      <mesh position={[0, coreOffset, 0]} ref={coreRef}>
        <coneGeometry args={[coreRadius, coreLength, 28]} />
        <meshBasicMaterial
          color={SPACE_COLORS.flameCore}
          depthWrite={false}
          opacity={0.88}
          transparent
        />
      </mesh>
      <SmokeTrail exhaustRadius={exhaust.radius} />
    </group>
  );
}

function SmokeTrail({ exhaustRadius }: { exhaustRadius: number }) {
  return (
    <group>
      {SMOKE_PARTICLES.map((particle) => (
        <SmokePuff
          exhaustRadius={exhaustRadius}
          index={particle.index}
          key={particle.id}
        />
      ))}
    </group>
  );
}

function SmokePuff({
  exhaustRadius,
  index,
}: {
  exhaustRadius: number;
  index: number;
}) {
  const puffRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!puffRef.current) {
      return;
    }

    const phase = (clock.elapsedTime * 0.74 + index / SMOKE_PARTICLE_COUNT) % 1;
    const drift = exhaustRadius * (2.4 + phase * 11 + index * 0.28);
    const wave =
      Math.sin(index * 1.7 + clock.elapsedTime * 2.1) * exhaustRadius * 0.92;
    puffRef.current.position.set(0, drift, wave);
    puffRef.current.scale.setScalar(exhaustRadius * (0.64 + phase * 2.25));
  });

  return (
    <mesh ref={puffRef}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial
        color={SPACE_COLORS.smoke}
        depthWrite={false}
        opacity={0.18}
        transparent
      />
    </mesh>
  );
}

useGLTF.preload(ACCELERATION_ROCKET_MODEL_PATH);

function getEngineFlameDirection(acceleration: number) {
  if (acceleration === 0) {
    return;
  }

  return -1;
}

function getRocketHeading(acceleration: number) {
  if (acceleration < 0) {
    return Math.PI;
  }

  return 0;
}

function LabFact({
  indicatorColor,
  label,
  value,
}: {
  indicatorColor?: string;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {indicatorColor ? (
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: indicatorColor }}
          />
        ) : null}
        {label}
      </dt>
      <dd className="wrap-break-word text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
