import { useFrame, useThree } from "@react-three/fiber";
import type { PlantTissue } from "@repo/design-system/components/contents/biology/tissue/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr, Match } from "effect";
import { createContext, use, useRef } from "react";
import type { Group } from "three";

type TissueParts = Readonly<
  Record<
    | "companion"
    | "lignin"
    | "lumen"
    | "nucleus"
    | "sievePlate"
    | "vacuole"
    | "wall",
    string
  >
>;

const DEFAULT_PARTS: TissueParts = {
  companion: "",
  lignin: "",
  lumen: "",
  nucleus: "",
  sievePlate: "",
  vacuole: "",
  wall: "",
};

const TissuePartsContext = createContext<TissueParts>(DEFAULT_PARTS);

const GRID_CELLS = [
  { id: "c00", x: -0.44, y: 0.28, z: -0.34 },
  { id: "c10", x: 0, y: 0.28, z: -0.34 },
  { id: "c20", x: 0.44, y: 0.28, z: -0.34 },
  { id: "c01", x: -0.44, y: 0.28, z: 0.1 },
  { id: "c11", x: 0, y: 0.28, z: 0.1 },
  { id: "c21", x: 0.44, y: 0.28, z: 0.1 },
  { id: "c02", x: -0.44, y: 0.72, z: -0.12 },
  { id: "c12", x: 0, y: 0.72, z: -0.12 },
  { id: "c22", x: 0.44, y: 0.72, z: -0.12 },
] as const;

const RING_Y = [0.22, 0.46, 0.7, 0.94] as const;

function TissueCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.7, 1.85, 3.2] : [1.35, 1.45, 2.55]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.5}
      minDistance={1.3}
    />
  );
}

function MeristemBlock() {
  const parts = use(TissuePartsContext);
  return (
    <group>
      {Arr.map(GRID_CELLS, (cell) => (
        <group key={cell.id} position={[cell.x, cell.y, cell.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.38, 0.38, 0.38]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.meristemCell}
              opacity={0.78}
              roughness={0.45}
              transparent
            />
          </mesh>
          <mesh castShadow>
            <sphereGeometry args={[0.11, 14, 12]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.nucleus}
              roughness={0.4}
            />
          </mesh>
        </group>
      ))}
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.62, 0.96, 0]}
      >
        <span>{parts.nucleus}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-0.74, 0.56, 0.25]}
      >
        <span>{parts.wall}</span>
      </ThreeLabel>
    </group>
  );
}

function EpidermisBlock() {
  const parts = use(TissuePartsContext);
  return (
    <group>
      <mesh castShadow position={[0, 0.78, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.1, 0.92]} />
        <meshPhysicalMaterial
          color={FOLIAGE_COLORS.cuticle}
          opacity={0.62}
          roughness={0.2}
          transparent
        />
      </mesh>
      {Arr.map([-0.48, 0, 0.48], (x) => (
        <group key={`epi-${x}`} position={[x, 0.48, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.45, 0.42, 0.84]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.epidermis}
              opacity={0.74}
              roughness={0.48}
              transparent
            />
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <boxGeometry args={[0.32, 0.26, 0.62]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.vacuole}
              roughness={0.35}
            />
          </mesh>
        </group>
      ))}
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.98, 0]}
      >
        <span>{parts.wall}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.74, 0.45, 0.3]}
      >
        <span>{parts.vacuole}</span>
      </ThreeLabel>
    </group>
  );
}

function GroundTissueBlock({
  thickCorners,
}: {
  readonly thickCorners: boolean;
}) {
  const parts = use(TissuePartsContext);
  return (
    <group>
      {Arr.map(
        [
          { id: "g1", x: -0.46, y: 0.36, z: -0.22 },
          { id: "g2", x: 0.04, y: 0.36, z: -0.22 },
          { id: "g3", x: 0.5, y: 0.36, z: -0.12 },
          { id: "g4", x: -0.24, y: 0.72, z: 0.16 },
          { id: "g5", x: 0.26, y: 0.72, z: 0.16 },
        ],
        (cell) => (
          <group key={cell.id} position={[cell.x, cell.y, cell.z]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry
                args={[0.24, 0.24, thickCorners ? 0.56 : 0.42, 6]}
              />
              <meshStandardMaterial
                color={
                  thickCorners
                    ? FOLIAGE_COLORS.collenchymaWall
                    : FOLIAGE_COLORS.parenchyma
                }
                opacity={0.78}
                roughness={0.46}
                transparent
              />
            </mesh>
            <mesh>
              <cylinderGeometry
                args={[0.16, 0.16, thickCorners ? 0.46 : 0.34, 6]}
              />
              <meshStandardMaterial
                color={FOLIAGE_COLORS.vacuole}
                roughness={0.35}
              />
            </mesh>
          </group>
        )
      )}
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-0.64, 0.88, 0.16]}
      >
        <span>{parts.wall}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.64, 0.84, 0.22]}
      >
        <span>{parts.vacuole}</span>
      </ThreeLabel>
    </group>
  );
}

function SclerenchymaBlock() {
  const parts = use(TissuePartsContext);
  return (
    <group>
      {Arr.map(
        [
          { id: "s1", x: -0.44, z: -0.18 },
          { id: "s2", x: 0.02, z: -0.18 },
          { id: "s3", x: 0.48, z: -0.18 },
          { id: "s4", x: -0.22, z: 0.22 },
          { id: "s5", x: 0.24, z: 0.22 },
        ],
        (fiber) => (
          <group key={fiber.id} position={[fiber.x, 0.56, fiber.z]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.24, 0.24, 0.94, 6]} />
              <meshStandardMaterial
                color={FOLIAGE_COLORS.sclerenchyma}
                roughness={0.58}
              />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.95, 12]} />
              <meshStandardMaterial
                color={FOLIAGE_COLORS.lumenVoid}
                roughness={0.8}
              />
            </mesh>
          </group>
        )
      )}
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-0.64, 1.08, 0]}
      >
        <span>{parts.lignin}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.56, 1.08, 0.22]}
      >
        <span>{parts.lumen}</span>
      </ThreeLabel>
    </group>
  );
}

function XylemBlock() {
  const parts = use(TissuePartsContext);
  return (
    <group>
      {Arr.map([-0.34, 0.34], (x) => (
        <group key={`xyl-${x}`} position={[x, 0.56, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.26, 0.26, 1.02, 20, 1, true]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.xylem}
              opacity={0.78}
              roughness={0.5}
              transparent
            />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.17, 0.17, 1.04, 18]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.lumenVoid}
              roughness={0.72}
            />
          </mesh>
          {Arr.map(RING_Y, (y) => (
            <mesh
              key={`ring-${x}-${y}`}
              position={[0, y - 0.56, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[0.265, 0.028, 10, 24]} />
              <meshStandardMaterial
                color={FOLIAGE_COLORS.lignin}
                roughness={0.48}
              />
            </mesh>
          ))}
        </group>
      ))}
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-0.72, 0.94, 0.12]}
      >
        <span>{parts.lignin}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.62, 1.12, 0]}
      >
        <span>{parts.lumen}</span>
      </ThreeLabel>
    </group>
  );
}

function PhloemBlock() {
  const parts = use(TissuePartsContext);
  return (
    <group>
      <group position={[-0.22, 0.56, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.25, 0.25, 1.0, 20]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.phloem}
            opacity={0.72}
            roughness={0.45}
            transparent
          />
        </mesh>
        {Arr.map([-0.14, 0.26], (y) => (
          <mesh key={`plate-${y}`} position={[0, y, 0]}>
            <cylinderGeometry args={[0.23, 0.23, 0.04, 18]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.sievePlate}
              roughness={0.5}
            />
          </mesh>
        ))}
      </group>
      <group position={[0.26, 0.56, 0.06]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.14, 0.14, 0.96, 14]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.companionCell}
            opacity={0.82}
            roughness={0.45}
            transparent
          />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.075, 14, 12]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.nucleus}
            roughness={0.4}
          />
        </mesh>
      </group>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-0.64, 0.88, 0.12]}
      >
        <span>{parts.sievePlate}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.82, 0.12]}
      >
        <span>{parts.companion}</span>
      </ThreeLabel>
    </group>
  );
}

export function PlantTissueScene({
  parts,
  tissue,
}: {
  readonly parts: TissueParts;
  readonly tissue: PlantTissue;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const specimenRef = useRef<Group>(null);
  const angleRef = useRef(0);

  useFrame((_, delta) => {
    if (!playing || specimenRef.current === null) {
      return;
    }
    angleRef.current += simulationStep(delta) * 0.45;
    specimenRef.current.rotation.y = Math.sin(angleRef.current) * 0.22;
  });

  const block = Match.value(tissue).pipe(
    Match.when("meristem", () => <MeristemBlock />),
    Match.when("epidermis", () => <EpidermisBlock />),
    Match.when("parenchyma", () => <GroundTissueBlock thickCorners={false} />),
    Match.when("collenchyma", () => <GroundTissueBlock thickCorners />),
    Match.when("sclerenchyma", () => <SclerenchymaBlock />),
    Match.when("xylem", () => <XylemBlock />),
    Match.when("phloem", () => <PhloemBlock />),
    Match.exhaustive
  );

  return (
    <TissuePartsContext value={parts}>
      <group>
        <SimulationTicker running={playing} />
        <TissueCamera />
        <mesh position={[0, 0.03, 0]} receiveShadow>
          <cylinderGeometry args={[1.08, 1.14, 0.06, 32]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.soilBase}
            roughness={0.72}
          />
        </mesh>
        <group ref={specimenRef}>{block}</group>
      </group>
    </TissuePartsContext>
  );
}
