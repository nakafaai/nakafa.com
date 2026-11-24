import { useFrame, useThree } from "@react-three/fiber";
import type { SurfacePreset } from "@repo/design-system/components/contents/chemistry/collision/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { KINETICS_COLORS } from "@repo/design-system/lib/material/kinetics";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function CollisionCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.55, 1.55, 3.2] : [1.25, 1.28, 2.5]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function CollisionVesselScene({
  concentrationM,
  parts,
  surface,
  temperatureK,
}: {
  readonly concentrationM: number;
  readonly parts: Readonly<
    Record<
      "activationLine" | "products" | "reactants" | "shadedArea" | "vessel",
      string
    >
  >;
  readonly surface: SurfacePreset;
  readonly temperatureK: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const swarmRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const solidPieces = useMemo(
    () =>
      Match.value(surface).pipe(
        Match.when("lump", () => [{ id: "s0", size: 0.24, x: 0, z: 0 }]),
        Match.when("granules", () => [
          { id: "s0", size: 0.13, x: -0.16, z: -0.1 },
          { id: "s1", size: 0.13, x: 0.16, z: -0.06 },
          { id: "s2", size: 0.13, x: 0, z: 0.16 },
        ]),
        Match.when("powder", () =>
          Arr.makeBy(8, (index) => ({
            id: `p-${index}`,
            size: 0.07,
            x: Math.cos(index * 0.8) * 0.24,
            z: Math.sin(index * 0.8) * 0.24,
          }))
        ),
        Match.exhaustive
      ),
    [surface]
  );

  const reactantCount = Math.min(
    18,
    Math.max(5, Math.round(concentrationM * 8))
  );
  const particles = useMemo(
    () =>
      Arr.makeBy(reactantCount, (index) => ({
        angle: index * 1.7,
        id: `r-${index}`,
        isProduct: index % 3 === 0,
        r: 0.18 + (index % 3) * 0.12,
      })),
    [reactantCount]
  );

  useFrame((_, delta) => {
    if (!playing || swarmRef.current === null) {
      return;
    }
    const speed = Math.sqrt(Math.max(250, temperatureK) / 300) * 2.4;
    phaseRef.current += simulationStep(delta) * speed;
    for (let i = 0; i < swarmRef.current.children.length; i += 1) {
      const child = swarmRef.current.children[i];
      const item = particles[i];
      if (child !== undefined && item !== undefined) {
        const t = phaseRef.current + item.angle;
        child.position.set(
          Math.cos(t) * item.r,
          0.32 + ((Math.sin(t * 1.4) + 1) / 2) * 0.62,
          Math.sin(t) * item.r
        );
      }
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <CollisionCamera />
      {/* Vessel base & glass wall */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.64, 0.68, 0.1, 24]} />
        <meshStandardMaterial
          color={KINETICS_COLORS.vesselBase}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.56, 0.56, 0.96, 28, 1, true]} />
        <meshPhysicalMaterial
          color={KINETICS_COLORS.vesselGlass}
          opacity={0.22}
          roughness={0.14}
          side={2}
          transparent
        />
      </mesh>
      {/* Solid reactant chunks/powder */}
      {Arr.map(solidPieces, (piece) => (
        <mesh
          castShadow
          key={piece.id}
          position={[piece.x, 0.14 + piece.size * 0.4, piece.z]}
        >
          <boxGeometry args={[piece.size, piece.size, piece.size]} />
          <meshStandardMaterial
            color={KINETICS_COLORS.solidBlock}
            roughness={0.65}
          />
        </mesh>
      ))}
      {/* Colliding reactant & product particles */}
      <group ref={swarmRef}>
        {Arr.map(particles, (item) => (
          <mesh
            key={item.id}
            position={[
              Math.cos(item.angle) * item.r,
              0.42 + (item.angle % 0.4),
              Math.sin(item.angle) * item.r,
            ]}
          >
            <sphereGeometry args={[0.048, 10, 8]} />
            <meshStandardMaterial
              color={
                item.isProduct
                  ? KINETICS_COLORS.product
                  : KINETICS_COLORS.reactant
              }
              roughness={0.34}
            />
          </mesh>
        ))}
      </group>
      {/* Labels */}
      <ThreeLabel
        color={KINETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.16, 0]}
      >
        <span>{parts.vessel}</span>
      </ThreeLabel>
      <ThreeLabel
        color={KINETICS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 0.72, 0]}
      >
        <span>{parts.reactants}</span>
      </ThreeLabel>
      <ThreeLabel
        color={KINETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0.78, 0.72, 0]}
      >
        <span>{parts.products}</span>
      </ThreeLabel>
    </group>
  );
}
