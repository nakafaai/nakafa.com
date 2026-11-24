import { useFrame, useThree } from "@react-three/fiber";
import type { StomataReading } from "@repo/design-system/components/contents/biology/stomata/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const ION_SLOTS = [
  { id: "i1", side: -1, z: -0.22 },
  { id: "i2", side: 1, z: -0.22 },
  { id: "i3", side: -1, z: 0.22 },
  { id: "i4", side: 1, z: 0.22 },
] as const;

function StomataCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.35, 2.6] : [0, 1.95, 2.15]}
      cameraTarget={[0, 0.24, 0]}
      fov={38}
      maxDistance={5.2}
      minDistance={1.2}
    />
  );
}

export function StomataScene({
  parts,
  reading,
}: {
  readonly parts: Readonly<
    Record<
      | "chloroplast"
      | "guardCell"
      | "pore"
      | "potassiumIon"
      | "thickInnerWall"
      | "thinOuterWall"
      | "vacuole"
      | "water",
      string
    >
  >;
  readonly reading: StomataReading;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const leftCellRef = useRef<Group>(null);
  const rightCellRef = useRef<Group>(null);
  const ionsRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const bowOffset = 0.14 + reading.openFraction * 0.28;
  const vacuoleScale = 0.45 + reading.openFraction * 0.65;

  useFrame((_, delta) => {
    const dt = simulationStep(delta);
    if (playing) {
      phaseRef.current += dt * 2.2;
    }
    const pulse = playing ? Math.sin(phaseRef.current) * 0.015 : 0;
    const target = bowOffset + pulse;
    if (leftCellRef.current !== null) {
      leftCellRef.current.position.x +=
        (-target - leftCellRef.current.position.x) * Math.min(1, dt * 8);
    }
    if (rightCellRef.current !== null) {
      rightCellRef.current.position.x +=
        (target - rightCellRef.current.position.x) * Math.min(1, dt * 8);
    }
    if (ionsRef.current !== null && playing) {
      ionsRef.current.position.y =
        0.24 + Math.sin(phaseRef.current * 1.4) * 0.04;
    }
  });

  const ionDist = reading.turgor === "turgid" ? 0.38 : 0.88;

  return (
    <group>
      <SimulationTicker running={playing} />
      <StomataCamera />
      {/* Surrounding epidermal bed */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[1.25, 1.3, 0.08, 32]} />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.epidermis}
          roughness={0.62}
        />
      </mesh>
      {/* Central stomatal pore shadow */}
      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry
          args={[Math.max(0.05, reading.openFraction * 0.26), 24]}
        />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.lumenVoid}
          roughness={0.9}
        />
      </mesh>

      {/* Left and right kidney guard cells */}
      <group position={[-bowOffset, 0.24, 0]} ref={leftCellRef}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.16, 0.56, 10, 18]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.guardWallOuter}
            opacity={0.74}
            roughness={0.42}
            transparent
          />
        </mesh>
        {/* Thick inner wall band facing the pore */}
        <mesh position={[0.13, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.055, 0.52, 8, 12]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.guardWallInner}
            roughness={0.4}
          />
        </mesh>
        {/* Swelling central vacuole */}
        <mesh scale={[vacuoleScale, vacuoleScale, vacuoleScale]}>
          <sphereGeometry args={[0.11, 14, 12]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.vacuole}
            roughness={0.32}
          />
        </mesh>
        {Arr.map([-0.2, 0.2], (z) => (
          <mesh key={`lc-${z}`} position={[-0.04, 0.06, z]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.chloroplast}
              roughness={0.4}
            />
          </mesh>
        ))}
      </group>

      <group position={[bowOffset, 0.24, 0]} ref={rightCellRef}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.16, 0.56, 10, 18]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.guardWallOuter}
            opacity={0.74}
            roughness={0.42}
            transparent
          />
        </mesh>
        <mesh position={[-0.13, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.055, 0.52, 8, 12]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.guardWallInner}
            roughness={0.4}
          />
        </mesh>
        <mesh scale={[vacuoleScale, vacuoleScale, vacuoleScale]}>
          <sphereGeometry args={[0.11, 14, 12]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.vacuole}
            roughness={0.32}
          />
        </mesh>
        {Arr.map([-0.2, 0.2], (z) => (
          <mesh key={`rc-${z}`} position={[0.04, 0.06, z]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.chloroplast}
              roughness={0.4}
            />
          </mesh>
        ))}
      </group>

      {/* Potassium ions & water migrating with turgor */}
      <group position={[0, 0.24, 0]} ref={ionsRef}>
        {Arr.map(ION_SLOTS, (slot) => (
          <group key={slot.id}>
            <mesh position={[slot.side * ionDist, 0.14, slot.z]}>
              <sphereGeometry args={[0.038, 10, 8]} />
              <meshStandardMaterial
                color={FOLIAGE_COLORS.potassiumIon}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[slot.side * (ionDist + 0.12), 0.1, slot.z * 0.5]}>
              <sphereGeometry args={[0.036, 10, 8]} />
              <meshStandardMaterial
                color={FOLIAGE_COLORS.waterMolecule}
                roughness={0.3}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Callouts */}
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.42, 0]}
      >
        <span>{parts.pore}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 0.44, -0.46]}
      >
        <span>{parts.guardCell}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.78, 0.44, -0.46]}
      >
        <span>{parts.thinOuterWall}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.48, -0.58]}
      >
        <span>{parts.thickInnerWall}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-0.74, 0.42, 0.48]}
      >
        <span>{parts.vacuole}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.76, 0.42, 0.48]}
      >
        <span>
          {parts.potassiumIon} / {parts.water}
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.42, 0.62]}
      >
        <span>{parts.chloroplast}</span>
      </ThreeLabel>
    </group>
  );
}
