import { useFrame, useThree } from "@react-three/fiber";
import type { LeafLayer } from "@repo/design-system/components/contents/biology/lamina/model";
import { leafLayerSpec } from "@repo/design-system/components/contents/biology/lamina/model";
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

const PALISADE_X = [-0.66, -0.44, -0.22, 0.22, 0.44, 0.66] as const;
const SPONGY_CELLS = [
  { id: "sp1", x: -0.62, y: 0.5, z: -0.18 },
  { id: "sp2", x: -0.34, y: 0.36, z: 0.16 },
  { id: "sp3", x: 0.34, y: 0.48, z: -0.14 },
  { id: "sp4", x: 0.6, y: 0.36, z: 0.16 },
  { id: "sp5", x: -0.5, y: 0.42, z: 0.22 },
  { id: "sp6", x: 0.48, y: 0.54, z: 0.2 },
] as const;

function LaminaCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.4, 1.1, 3.2] : [0.3, 0.95, 2.55]}
      cameraTarget={[0, 0.68, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function LeafLaminaScene({
  activeLayer,
  parts,
}: {
  readonly activeLayer: LeafLayer;
  readonly parts: Readonly<
    Record<
      "airSpace" | "chloroplast" | "guardCell" | "phloem" | "xylem",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const specimenRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const focus = leafLayerSpec(activeLayer);

  useFrame((_, delta) => {
    if (!playing || specimenRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.45;
    specimenRef.current.rotation.y = Math.sin(phaseRef.current) * 0.18;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <LaminaCamera />
      <group ref={specimenRef}>
        {/* Waxy cuticle */}
        <mesh castShadow position={[0, 1.24, 0]}>
          <boxGeometry args={[1.64, 0.06, 0.84]} />
          <meshPhysicalMaterial
            color={FOLIAGE_COLORS.cuticle}
            opacity={activeLayer === "cuticle" ? 0.9 : 0.56}
            roughness={0.18}
            transparent
          />
        </mesh>

        {/* Upper epidermis */}
        <mesh castShadow position={[0, 1.1, 0]}>
          <boxGeometry args={[1.62, 0.16, 0.8]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.epidermis}
            opacity={activeLayer === "upperEpidermis" ? 0.92 : 0.65}
            roughness={0.45}
            transparent
          />
        </mesh>

        {/* Palisade mesophyll columns + chloroplasts */}
        {Arr.map(PALISADE_X, (x) => (
          <group key={`pal-${x}`} position={[x, 0.82, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.095, 0.095, 0.36, 12]} />
              <meshStandardMaterial
                color={FOLIAGE_COLORS.palisade}
                opacity={activeLayer === "palisade" ? 0.95 : 0.72}
                roughness={0.44}
                transparent
              />
            </mesh>
            {Arr.map([-0.1, 0, 0.1], (dy) => (
              <mesh key={`chl-${x}-${dy}`} position={[0.06, dy, 0.07]}>
                <sphereGeometry args={[0.028, 10, 8]} />
                <meshStandardMaterial
                  color={FOLIAGE_COLORS.chloroplastInner}
                  roughness={0.38}
                />
              </mesh>
            ))}
          </group>
        ))}

        {/* Spongy mesophyll cells & intercellular air spaces */}
        {Arr.map(SPONGY_CELLS, (cell) => (
          <mesh castShadow key={cell.id} position={[cell.x, cell.y, cell.z]}>
            <sphereGeometry args={[0.12, 14, 12]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.spongy}
              opacity={activeLayer === "spongy" ? 0.95 : 0.74}
              roughness={0.48}
              transparent
            />
          </mesh>
        ))}

        {/* Vascular bundle (xylem above phloem) */}
        <group position={[0, 0.58, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.78, 20]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.vascularSheath}
              opacity={activeLayer === "vascular" ? 0.85 : 0.5}
              roughness={0.5}
              transparent
            />
          </mesh>
          <mesh position={[0, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.82, 14]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.xylem}
              roughness={0.48}
            />
          </mesh>
          <mesh position={[0, -0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.82, 14]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.phloem}
              roughness={0.48}
            />
          </mesh>
        </group>

        {/* Lower epidermis split around stoma */}
        {Arr.map([-0.54, 0.54], (x) => (
          <mesh castShadow key={`low-${x}`} position={[x, 0.18, 0]}>
            <boxGeometry args={[0.56, 0.14, 0.78]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.epidermis}
              opacity={activeLayer === "lowerEpidermis" ? 0.92 : 0.65}
              roughness={0.48}
              transparent
            />
          </mesh>
        ))}

        {/* Paired stomatal guard cells */}
        {Arr.map([-0.14, 0.14], (x) => (
          <mesh
            castShadow
            key={`gc-${x}`}
            position={[x, 0.16, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <capsuleGeometry args={[0.055, 0.3, 8, 12]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.guardWallInner}
              roughness={0.42}
            />
          </mesh>
        ))}

        {/* Focus height marker */}
        <mesh position={[-0.92, focus.focusY, 0]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.scanRing}
            roughness={0.32}
          />
        </mesh>

        {/* Anatomical callouts */}
        <ThreeLabel
          color={FOLIAGE_COLORS.labelInk}
          fontSize="compact"
          position={[0.88, 0.84, 0.16]}
        >
          <span>{parts.chloroplast}</span>
        </ThreeLabel>
        <ThreeLabel
          color={FOLIAGE_COLORS.labelInk}
          fontSize="compact"
          position={[-0.86, 0.44, 0.24]}
        >
          <span>{parts.airSpace}</span>
        </ThreeLabel>
        <ThreeLabel
          color={FOLIAGE_COLORS.labelInk}
          fontSize="compact"
          position={[0.16, 0.72, 0.44]}
        >
          <span>{parts.xylem}</span>
        </ThreeLabel>
        <ThreeLabel
          color={FOLIAGE_COLORS.labelInk}
          fontSize="compact"
          position={[0.18, 0.44, 0.44]}
        >
          <span>{parts.phloem}</span>
        </ThreeLabel>
        <ThreeLabel
          color={FOLIAGE_COLORS.labelInk}
          fontSize="compact"
          position={[0, 0.02, 0.44]}
        >
          <span>{parts.guardCell}</span>
        </ThreeLabel>
      </group>
    </group>
  );
}
