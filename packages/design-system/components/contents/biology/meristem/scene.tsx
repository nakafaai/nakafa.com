import { useFrame, useThree } from "@react-three/fiber";
import type {
  GrowthMode,
  PlantOrgan,
} from "@repo/design-system/components/contents/biology/meristem/model";
import {
  evaluatePrimaryZone,
  evaluateSecondaryGrowth,
} from "@repo/design-system/components/contents/biology/meristem/model";
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
import { createContext, use, useMemo, useRef } from "react";
import type { Group } from "three";

type MeristemParts = Readonly<
  Record<
    | "annualRing"
    | "apicalMeristem"
    | "corkCambium"
    | "rootCap"
    | "rootHair"
    | "secondaryPhloem"
    | "secondaryXylem"
    | "vacuole"
    | "vascularCambium",
    string
  >
>;

const DEFAULT_PARTS: MeristemParts = {
  annualRing: "",
  apicalMeristem: "",
  corkCambium: "",
  rootCap: "",
  rootHair: "",
  secondaryPhloem: "",
  secondaryXylem: "",
  vacuole: "",
  vascularCambium: "",
};

const MeristemPartsContext = createContext<MeristemParts>(DEFAULT_PARTS);

const ROOT_HAIRS = [
  { id: "h1", side: -1, y: 1.06 },
  { id: "h2", side: 1, y: 1.18 },
  { id: "h3", side: -1, y: 1.3 },
] as const;

function MeristemCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [1.75, 1.55, 3.35] : [1.4, 1.35, 2.75]}
      cameraTarget={[0, 0.78, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.4}
    />
  );
}

function PrimaryApexView({
  organ,
  position,
}: {
  readonly organ: PlantOrgan;
  readonly position: number;
}) {
  const parts = use(MeristemPartsContext);
  const scan = evaluatePrimaryZone(position);
  const isRoot = organ === "root";
  const scanY = isRoot ? scan.axisY : 1.58 - scan.axisY;

  return (
    <group>
      {/* Main organ cylinder */}
      <mesh castShadow position={[0, 0.82, 0]} receiveShadow>
        <cylinderGeometry args={[0.28, 0.24, 1.16, 22]} />
        <meshStandardMaterial
          color={isRoot ? FOLIAGE_COLORS.epidermis : FOLIAGE_COLORS.palisade}
          opacity={0.72}
          roughness={0.48}
          transparent
        />
      </mesh>
      {/* Apical meristem dome */}
      <mesh castShadow position={[0, isRoot ? 0.34 : 1.36, 0]}>
        <sphereGeometry args={[0.2, 18, 14]} />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.meristemCell}
          roughness={0.4}
        />
      </mesh>
      {/* Elongating vacuoles in middle zone */}
      {Arr.map([-0.08, 0.08], (x) => (
        <mesh key={`vac-${x}`} position={[x, 0.78, 0.06]}>
          <capsuleGeometry args={[0.045, 0.24, 8, 12]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.vacuole}
            roughness={0.35}
          />
        </mesh>
      ))}
      {isRoot ? (
        <group>
          {/* Root cap thimble */}
          <mesh castShadow position={[0, 0.16, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.24, 0.28, 20]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.rootCap}
              roughness={0.62}
            />
          </mesh>
          {/* Root hairs in differentiation zone */}
          {Arr.map(ROOT_HAIRS, (hair) => (
            <mesh
              castShadow
              key={hair.id}
              position={[hair.side * 0.42, hair.y, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.02, 0.028, 0.36, 10]} />
              <meshStandardMaterial
                color={FOLIAGE_COLORS.rootHair}
                roughness={0.55}
              />
            </mesh>
          ))}
          <ThreeLabel
            color={FOLIAGE_COLORS.labelInk}
            fontSize="compact"
            position={[-0.64, 0.16, 0]}
          >
            <span>{parts.rootCap}</span>
          </ThreeLabel>
          <ThreeLabel
            color={FOLIAGE_COLORS.labelInk}
            fontSize="compact"
            position={[0.78, 1.18, 0]}
          >
            <span>{parts.rootHair}</span>
          </ThreeLabel>
        </group>
      ) : (
        <group>
          {/* Leaf primordia flanking shoot apex */}
          {Arr.map([-1, 1], (side) => (
            <mesh
              castShadow
              key={`prim-${side}`}
              position={[side * 0.28, 1.44, 0]}
              rotation={[0, 0, -side * 0.55]}
            >
              <coneGeometry args={[0.11, 0.34, 12]} />
              <meshStandardMaterial
                color={FOLIAGE_COLORS.spongy}
                roughness={0.45}
              />
            </mesh>
          ))}
        </group>
      )}
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, isRoot ? 0.38 : 1.4, 0]}
      >
        <span>{parts.apicalMeristem}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-0.66, 0.78, 0.12]}
      >
        <span>{parts.vacuole}</span>
      </ThreeLabel>
      {/* Active zone scanner ring */}
      <mesh position={[0, scanY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.024, 12, 32]} />
        <meshStandardMaterial color={FOLIAGE_COLORS.scanRing} roughness={0.3} />
      </mesh>
    </group>
  );
}

function SecondaryTrunkView({ years }: { readonly years: number }) {
  const parts = use(MeristemPartsContext);
  const cross = evaluateSecondaryGrowth(years);
  const rings = useMemo(
    () =>
      Arr.makeBy(cross.ringCount, (index) => ({
        even: index % 2 === 0,
        id: `ring-${index + 1}`,
        radius: 0.22 + (index + 1) * 0.055,
      })),
    [cross.ringCount]
  );

  return (
    <group position={[0, 0.54, 0]}>
      {/* Outer bark & cork cambium */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry
          args={[cross.outerRadius, cross.outerRadius, 0.52, 32]}
        />
        <meshStandardMaterial color={FOLIAGE_COLORS.bark} roughness={0.78} />
      </mesh>
      {/* Secondary phloem band */}
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry
          args={[cross.outerRadius - 0.05, cross.outerRadius - 0.05, 0.52, 32]}
        />
        <meshStandardMaterial color={FOLIAGE_COLORS.phloem} roughness={0.52} />
      </mesh>
      {/* Vascular cambium ring */}
      <mesh position={[0, 0.028, 0]}>
        <cylinderGeometry
          args={[cross.xylemRadius + 0.03, cross.xylemRadius + 0.03, 0.52, 32]}
        />
        <meshStandardMaterial color={FOLIAGE_COLORS.cambium} roughness={0.4} />
      </mesh>
      {/* Concentric secondary xylem annual rings */}
      <mesh position={[0, 0.036, 0]}>
        <cylinderGeometry
          args={[cross.xylemRadius, cross.xylemRadius, 0.52, 32]}
        />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.annualEarly}
          roughness={0.55}
        />
      </mesh>
      {Arr.map(rings, (ring) => (
        <mesh
          key={ring.id}
          position={[0, 0.305, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[ring.radius - 0.02, 0.011, 8, 36]} />
          <meshStandardMaterial
            color={
              ring.even ? FOLIAGE_COLORS.annualLate : FOLIAGE_COLORS.stemWood
            }
            roughness={0.58}
          />
        </mesh>
      ))}
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.56, 0]}
      >
        <span>{parts.annualRing}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-cross.outerRadius - 0.3, 0.34, 0.14]}
      >
        <span>{parts.vascularCambium}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[cross.outerRadius + 0.34, 0.24, 0]}
      >
        <span>{parts.corkCambium}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[cross.xylemRadius * 0.48, 0.42, cross.xylemRadius * 0.6]}
      >
        <span>{parts.secondaryXylem}</span>
      </ThreeLabel>
      <ThreeLabel
        color={FOLIAGE_COLORS.labelInk}
        fontSize="compact"
        position={[-cross.xylemRadius * 0.55, 0.18, cross.outerRadius * 0.72]}
      >
        <span>{parts.secondaryPhloem}</span>
      </ThreeLabel>
    </group>
  );
}

export function MeristemGrowthScene({
  mode,
  organ,
  parts,
  position,
  years,
}: {
  readonly mode: GrowthMode;
  readonly organ: PlantOrgan;
  readonly parts: MeristemParts;
  readonly position: number;
  readonly years: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const specimenRef = useRef<Group>(null);
  const angleRef = useRef(0);

  useFrame((_, delta) => {
    if (!playing || specimenRef.current === null) {
      return;
    }
    angleRef.current += simulationStep(delta) * 0.4;
    specimenRef.current.rotation.y = Math.sin(angleRef.current) * 0.25;
  });

  return (
    <MeristemPartsContext value={parts}>
      <group>
        <SimulationTicker running={playing} />
        <MeristemCamera />
        <group ref={specimenRef}>
          {mode === "primary" ? (
            <PrimaryApexView organ={organ} position={position} />
          ) : (
            <SecondaryTrunkView years={years} />
          )}
        </group>
      </group>
    </MeristemPartsContext>
  );
}
