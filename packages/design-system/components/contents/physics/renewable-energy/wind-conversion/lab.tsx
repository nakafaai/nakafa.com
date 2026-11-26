import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ReactNode, RefObject } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { ExtrudeGeometry, Shape } from "three";

const MIN_WIND_SPEED = 3;
const MAX_WIND_SPEED = 12;
const DEFAULT_WIND_SPEED = 7;
const WIND_GUST_COUNT = 72;
const GUST_SWIRL = 0.16;
const GUST_LIFT = 0.08;
const GUST_FRONT_Z = 1.42;
const GUST_TRAVEL = 1.85;
const GUST_DEPTH_SCALE = 0.7;
const WIND_GUSTS = Array.from({ length: WIND_GUST_COUNT }, (_, index) => ({
  id: `wind-gust-${index}`,
  index,
}));

interface WindEnergyConversionLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    flow: ReactNode;
    flowLabel: string;
    meaning: ReactNode;
    meaningLabel: string;
    speedControl: string;
    speedUnit: string;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/** The height of the ground the tower's foot stands on: the scaled bottom of its base. */
const TOWER_FOOT_Y = -0.02 + 1.18 * (-0.42 - 0.09);

/**
 * Shows wind energy conversion as one interactive 3D system: moving air turns a
 * rotor while the nacelle houses the generator.
 */
export function WindEnergyConversionLab({
  description,
  labels,
  title,
}: WindEnergyConversionLabProps) {
  const [windSpeed, setWindSpeed] = useState(DEFAULT_WIND_SPEED);
  const colors = getWindSceneColors();

  function handleSpeedChange(nextValue: number) {
    setWindSpeed(nextValue);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.speedControl}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`${windSpeed}\\ \\text{${labels.speedUnit}}`} />
            </span>
          </div>
          <Slider
            aria-label={labels.speedControl}
            max={MAX_WIND_SPEED}
            min={MIN_WIND_SPEED}
            onValueChange={handleSpeedChange}
            step={1}
            value={windSpeed}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={TOWER_FOOT_Y}
          frameloop="always"
          ground="grass"
          setting="field"
        >
          <Suspense>
            <CameraControls
              cameraPosition={[2.65, 2, 4.7]}
              cameraTarget={[0.03, 0.94, 0.14]}
              fov={34}
            />
            <WindConversionScene
              colors={colors}
              onReset={() => setWindSpeed(DEFAULT_WIND_SPEED)}
              windSpeed={windSpeed}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.flowLabel} value={labels.flow} />
          <VisualFact label={labels.meaningLabel} value={labels.meaning} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

function WindConversionScene({
  colors,
  onReset,
  windSpeed,
}: {
  colors: ReturnType<typeof getWindSceneColors>;
  onReset: () => void;
  windSpeed: number;
}) {
  const rotorRef = useRef<Group>(null);
  const playing = useVisualScene((card) => card.playing, true);

  useVisualStop(() => {
    if (rotorRef.current) {
      rotorRef.current.rotation.z = 0;
    }
  });
  useVisualReset(onReset);

  useFrame((_, delta) => {
    if (!(playing && rotorRef.current)) {
      return;
    }

    rotorRef.current.rotation.z -= simulationStep(delta) * windSpeed * 1.05;
  });

  return (
    <group position={[0, -0.02, 0]} scale={1.18}>
      <group>
        {Arr.map(WIND_GUSTS, (gust) => (
          <WindGust
            color={colors.wind}
            index={gust.index}
            key={gust.id}
            playing={playing}
            windSpeed={windSpeed}
          />
        ))}
      </group>
      <WindTurbine rotorRef={rotorRef} />
    </group>
  );
}

function WindGust({
  color,
  index,
  playing,
  windSpeed,
}: {
  color: string;
  index: number;
  playing: boolean;
  windSpeed: number;
}) {
  const ref = useRef<Group>(null);
  const timeRef = useRef(0);
  const seed = useMemo(() => {
    const column = index % 9;
    const row = Math.floor(index / 9) % 8;

    return {
      baseX: (column - 4) * 0.07 + Math.sin(index * 1.7) * 0.018,
      baseY: 1.2 + (row - 3.5) * 0.11 + Math.cos(index * 1.1) * 0.028,
      phase: (index * 0.137) % 1,
      size: 0.72 + ((index * 17) % 7) * 0.045,
      spin: index % 2 === 0 ? 1 : -1,
    };
  }, [index]);

  useVisualStop(() => {
    timeRef.current = 0;
  });

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    const speed = 0.18 + windSpeed * 0.035;
    if (playing) {
      timeRef.current += simulationStep(delta) * speed;
    }
    const progress = (timeRef.current + seed.phase) % 1;
    const wakeProgress = Math.max(0, (progress - 0.58) / 0.42);
    const swirl =
      Math.sin(wakeProgress * Math.PI * 2.4 + index * 0.73) *
      wakeProgress *
      GUST_SWIRL;
    const lift =
      Math.cos(wakeProgress * Math.PI * 1.8 + index) * wakeProgress * GUST_LIFT;

    ref.current.position.x = seed.baseX + swirl;
    ref.current.position.y = seed.baseY + lift;
    ref.current.position.z = GUST_FRONT_Z - progress * GUST_TRAVEL;
    ref.current.rotation.set(
      Math.PI / 2 + wakeProgress * 0.34,
      seed.spin * (0.34 + wakeProgress * 0.55),
      seed.spin * 0.2 + swirl * 2.1
    );
    ref.current.scale.set(
      seed.size * 0.42,
      seed.size * (0.16 - wakeProgress * 0.04),
      seed.size * GUST_DEPTH_SCALE
    );
  });

  return (
    <group ref={ref}>
      <mesh>
        <icosahedronGeometry args={[0.08, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.12}
          opacity={0.22}
          roughness={0.5}
          transparent
        />
      </mesh>
    </group>
  );
}

/** The blade's chord from root to tip, as a share of its length and in scene units: widest a fifth of the way out, as a modern blade is. */
const CHORD = [
  [0, 0.05],
  [0.08, 0.06],
  [0.2, 0.11],
  [0.45, 0.085],
  [0.75, 0.055],
  [1, 0.018],
] as const;

/** The blade's length from the hub's face to its tip, in scene units. */
const BLADE = 1.02;

/** The blade's planform: a straight leading edge and a trailing edge that follows the chord. */
function bladeShape() {
  const shape = new Shape();
  shape.moveTo(0, 0);
  Arr.forEach(CHORD, ([along]) => {
    shape.lineTo(-0.015 * along, along * BLADE);
  });
  Arr.forEach(Arr.reverse(CHORD), ([along, chord]) => {
    shape.lineTo(chord, along * BLADE);
  });
  shape.closePath();
  return shape;
}

/** The tower's flanges, where its rolled sections are bolted together. */
const FLANGES = [-0.05, 0.45, 0.9] as const;

/**
 * A three-bladed utility turbine of real proportions: a tapered white
 * tubular tower with bolted flanges and a door at its foot on a concrete
 * plinth, a streamlined nacelle with its cooler and anemometer mast, a
 * pointed spinner, and blades with a real chord, widest near the root,
 * pitched into the wind.
 */
function WindTurbine({ rotorRef }: { rotorRef: RefObject<Group | null> }) {
  const blade = useMemo(
    () =>
      new ExtrudeGeometry(bladeShape(), {
        bevelEnabled: true,
        bevelSegments: 3,
        bevelSize: 0.008,
        bevelThickness: 0.008,
        curveSegments: 4,
        depth: 0.006,
      }),
    []
  );
  useEffect(() => () => blade.dispose(), [blade]);

  return (
    <group>
      <mesh castShadow position={[0, 0.42, 0]} receiveShadow>
        <cylinderGeometry args={[0.048, 0.075, 1.62, 40]} />
        <SurfaceMaterial color={MACHINE_COLORS.turbineWhite} surface="paint" />
      </mesh>
      {Arr.map(FLANGES, (y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry
            args={[0.075 - ((y + 0.39) / 1.62) * 0.027, 0.004, 6, 40]}
          />
          <SurfaceMaterial
            color={MACHINE_COLORS.turbineWhite}
            surface="paint"
          />
        </mesh>
      ))}
      <RoundedBox
        args={[0.05, 0.11, 0.03]}
        position={[0, -0.27, 0.067]}
        radius={0.01}
        smoothness={2}
      >
        <SurfaceMaterial color={CAR_COLORS.hub} surface="paint" />
      </RoundedBox>
      <mesh castShadow position={[0, -0.42, 0]} receiveShadow>
        <cylinderGeometry args={[0.2, 0.24, 0.18, 48]} />
        <SurfaceMaterial color={MACHINE_COLORS.concrete} surface="concrete" />
      </mesh>

      <group position={[0.2, 1.25, -0.02]}>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.12, 0.5, 8, 24]} />
          <SurfaceMaterial
            color={MACHINE_COLORS.turbineWhite}
            surface="paint"
          />
        </mesh>
        <RoundedBox
          args={[0.2, 0.06, 0.16]}
          castShadow
          position={[0.2, 0.13, 0]}
          radius={0.02}
          smoothness={2}
        >
          <SurfaceMaterial
            color={MACHINE_COLORS.turbineWhite}
            surface="paint"
          />
        </RoundedBox>
        <mesh castShadow position={[0.32, 0.22, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.16, 6]} />
          <SurfaceMaterial
            color={CAR_COLORS.hub}
            metalness={1}
            surface="brushed"
          />
        </mesh>
      </group>
      <mesh
        castShadow
        position={[-0.02, 1.25, 0.12]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.07, 0.11, 0.14, 32]} />
        <SurfaceMaterial color={MACHINE_COLORS.turbineWhite} surface="paint" />
      </mesh>
      <group position={[-0.08, 1.25, 0.26]}>
        <group ref={rotorRef}>
          {Arr.map([0, 1, 2], (bladeIndex) => (
            <group
              key={bladeIndex}
              rotation={[0, 0, (bladeIndex * Math.PI * 2) / 3]}
            >
              <mesh
                castShadow
                geometry={blade}
                position={[0, 0.08, 0]}
                rotation={[0, 0.18, 0]}
              >
                <SurfaceMaterial
                  color={MACHINE_COLORS.turbineWhite}
                  surface="plastic"
                />
              </mesh>
              <mesh castShadow position={[0, 0.08, 0]}>
                <cylinderGeometry args={[0.035, 0.04, 0.12, 18]} />
                <SurfaceMaterial
                  color={MACHINE_COLORS.turbineWhite}
                  surface="plastic"
                />
              </mesh>
            </group>
          ))}
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.5, 1]}>
            <sphereGeometry
              args={[0.1, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <SurfaceMaterial
              color={MACHINE_COLORS.turbineWhite}
              surface="plastic"
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function getWindSceneColors() {
  return { wind: PLOT_COLORS.teal };
}
