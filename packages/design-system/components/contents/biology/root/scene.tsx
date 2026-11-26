import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useRootAnatomyGeometries } from "@repo/design-system/components/contents/biology/root/anatomy";
import type { WaterDirection } from "@repo/design-system/components/contents/biology/root/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr, Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const SOIL_PEBBLES = [
  {
    id: "p1",
    pos: [-1.32, 0.34, 0.24] as const,
    r: 0.048,
    tint: BOTANY_COLORS.heavyMetal,
  },
  {
    id: "p2",
    pos: [-1.1, 0.26, 0.28] as const,
    r: 0.042,
    tint: BOTANY_COLORS.rootIvory,
  },
  {
    id: "p3",
    pos: [-1.24, 0.64, 0.22] as const,
    r: 0.044,
    tint: BOTANY_COLORS.barkBrown,
  },
  {
    id: "p4",
    pos: [-0.94, 0.34, 0.27] as const,
    r: 0.036,
    tint: BOTANY_COLORS.heavyMetal,
  },
  {
    id: "p5",
    pos: [-1.36, 0.56, -0.14] as const,
    r: 0.052,
    tint: BOTANY_COLORS.barkBrown,
  },
  {
    id: "p6",
    pos: [-0.96, 0.68, 0.16] as const,
    r: 0.038,
    tint: BOTANY_COLORS.rootIvory,
  },
] as const;

const CELL_ROWS = [
  { id: "r-bot", y: 0.32 },
  { id: "r-mid", y: 0.56 },
  { id: "r-top", y: 0.8 },
] as const;

const CORTEX_GRID = [
  { id: "c-0-0", x: -0.26, y: 0.33 },
  { id: "c-0-1", x: -0.26, y: 0.57 },
  { id: "c-0-2", x: -0.26, y: 0.81 },
  { id: "c-1-0", x: -0.01, y: 0.44 },
  { id: "c-1-1", x: -0.01, y: 0.68 },
  { id: "c-2-0", x: 0.24, y: 0.33 },
  { id: "c-2-1", x: 0.24, y: 0.57 },
  { id: "c-2-2", x: 0.24, y: 0.81 },
  { id: "c-3-0", x: 0.45, y: 0.44 },
  { id: "c-3-1", x: 0.45, y: 0.68 },
] as const;

const LIGNIN_RINGS = [-0.26, -0.14, -0.02, 0.1, 0.22, 0.32] as const;
const STREAM_OFFSETS = [0, 0.33, 0.66] as const;

function RootCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.56, 3.85] : [0, 1.28, 3.3]}
      cameraTarget={[-0.08, 0.56, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.4}
    />
  );
}

export function RootHairScene({
  direction,
  fluxSpeed,
  parts,
}: {
  readonly direction: WaterDirection;
  readonly fluxSpeed: number;
  readonly parts: Readonly<
    Record<
      | "cortex"
      | "endodermis"
      | "epidermis"
      | "rootHair"
      | "soilWater"
      | "xylem",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const labelInk = useLabelInk();
  const geos = useRootAnatomyGeometries();
  const waterRefs = useRef<(Group | null)[]>([null, null, null]);
  const ionRefs = useRef<(Group | null)[]>([null, null, null]);
  const phaseRef = useRef(0);

  const placeParticles = (phase: number) => {
    for (let i = 0; i < STREAM_OFFSETS.length; i += 1) {
      const offset = STREAM_OFFSETS[i];
      const tRaw = (phase + offset) % 1;
      const waterNode = waterRefs.current[i];
      if (waterNode !== null) {
        const u = Match.value(direction).pipe(
          Match.when("intoRoot", () => tRaw),
          Match.when("outOfRoot", () => 1 - tRaw),
          Match.when(
            "balanced",
            () =>
              0.18 + offset * 0.55 + Math.sin(phase * Math.PI * 2 + i) * 0.06
          ),
          Match.exhaustive
        );
        const pt = geos.waterPath.getPoint(Math.min(1, Math.max(0, u)));
        waterNode.position.copy(pt);
      }
      const ionNode = ionRefs.current[i];
      if (ionNode !== null) {
        const pt = geos.ionPath.getPoint(tRaw);
        ionNode.position.copy(pt);
        ionNode.rotation.y = phase * Math.PI * 2 + i;
      }
    }
  };

  useVisualStop(() => {
    phaseRef.current = 0;
    placeParticles(0.12);
  });

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * fluxSpeed * 0.55;
    placeParticles(phaseRef.current);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <RootCamera />

      {/* Organic moist soil cross-section recessed slightly behind the root hair so the full hair is clearly visible */}
      <group position={[-1.18, 0.46, -0.16]} scale={[1.05, 0.96, 0.72]}>
        <mesh castShadow geometry={geos.soilMound} receiveShadow>
          <SurfaceMaterial
            color={BOTANY_COLORS.soilDark}
            roughness={0.92}
            surface="concrete"
          />
        </mesh>
      </group>
      {/* Mineral soil pebbles around the living root hair */}
      {Arr.map(SOIL_PEBBLES, (peb) => (
        <mesh
          castShadow
          key={peb.id}
          position={[peb.pos[0], peb.pos[1], peb.pos[2] - 0.14]}
          scale={[1.15, 0.78, 0.92]}
        >
          <dodecahedronGeometry args={[peb.r, 1]} />
          <meshStandardMaterial color={peb.tint} roughness={0.84} />
        </mesh>
      ))}
      {/* Translucent living root hair extending visibly through moist soil grains */}
      <group position={[0, 0, 0.14]}>
        <mesh castShadow geometry={geos.rootHairOuter}>
          <meshPhysicalMaterial
            clearcoat={0.35}
            color={BOTANY_COLORS.epidermisTan}
            opacity={0.84}
            roughness={0.36}
            transparent
          />
        </mesh>
        <mesh geometry={geos.rootHairVacuole}>
          <meshPhysicalMaterial
            color={BOTANY_COLORS.cohesionCyan}
            opacity={0.58}
            roughness={0.18}
            transparent
          />
        </mesh>
        <mesh position={[-1.18, 0.51, 0.03]}>
          <sphereGeometry args={[0.038, 14, 12]} />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={BOTANY_COLORS.epidermisTan}
            roughness={0.38}
          />
        </mesh>
      </group>

      {/* Plump polygonal epidermis column */}
      {Arr.map(CELL_ROWS, (row) => (
        <mesh
          castShadow
          geometry={geos.epidermisCell}
          key={`ep-${row.id}`}
          position={[-0.5, row.y, 0]}
          receiveShadow
        >
          <meshPhysicalMaterial
            clearcoat={0.22}
            color={BOTANY_COLORS.epidermisTan}
            roughness={0.5}
          />
        </mesh>
      ))}

      {/* Staggered living parenchyma cortex cells with inner watery vacuoles */}
      {Arr.map(CORTEX_GRID, (cell) => (
        <group key={cell.id} position={[cell.x, cell.y, 0]}>
          <mesh castShadow geometry={geos.cortexCell} receiveShadow>
            <meshPhysicalMaterial
              clearcoat={0.18}
              color={BOTANY_COLORS.cortexCream}
              opacity={0.88}
              roughness={0.48}
              transparent
            />
          </mesh>
          <mesh geometry={geos.cortexVacuole}>
            <meshPhysicalMaterial
              color={BOTANY_COLORS.cohesionCyan}
              opacity={0.38}
              roughness={0.22}
              transparent
            />
          </mesh>
        </group>
      ))}

      {/* Barrel-shaped Endodermis ring with waxy rust Casparian strip */}
      <group position={[0.68, 0.56, 0]}>
        {Arr.map(CELL_ROWS, (row) => (
          <mesh
            castShadow
            geometry={geos.endodermisCell}
            key={`en-${row.id}`}
            position={[0, row.y - 0.56, 0]}
            receiveShadow
          >
            <meshPhysicalMaterial
              clearcoat={0.26}
              color={BOTANY_COLORS.epidermisTan}
              roughness={0.46}
            />
          </mesh>
        ))}
        <mesh castShadow geometry={geos.casparianLoop}>
          <meshPhysicalMaterial
            clearcoat={0.55}
            clearcoatRoughness={0.2}
            color={BOTANY_COLORS.endodermisRust}
            roughness={0.32}
          />
        </mesh>
      </group>

      {/* Hollow lignified Xylem vessel with annular thickening rings & water column */}
      <group position={[1.0, 0.56, 0]}>
        <mesh castShadow geometry={geos.xylemTube} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.25}
            color={BOTANY_COLORS.xylemCrimson}
            roughness={0.48}
            side={2}
          />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.104, 0.104, 0.72, 20]} />
          <meshPhysicalMaterial
            clearcoat={0.75}
            color={BOTANY_COLORS.waterBlue}
            opacity={0.52}
            roughness={0.12}
            transparent
          />
        </mesh>
        {Arr.map(LIGNIN_RINGS, (ry) => (
          <mesh
            key={`lr-${ry}`}
            position={[0, ry, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.148, 0.015, 10, 24, Math.PI * 1.48]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.ligninBrown}
              roughness={0.62}
            />
          </mesh>
        ))}
      </group>

      {/* Animated refractive water droplets */}
      {Arr.map(STREAM_OFFSETS, (offset, idx) => {
        const initialPt = geos.waterPath.getPoint((0.12 + offset) % 1);
        return (
          <group
            key={`wd-${offset}`}
            position={[initialPt.x, initialPt.y, initialPt.z]}
            ref={(el) => {
              waterRefs.current[idx] = el;
            }}
          >
            <mesh geometry={geos.waterDroplet} rotation={[0, 0, -Math.PI / 2]}>
              <meshPhysicalMaterial
                clearcoat={0.9}
                clearcoatRoughness={0.08}
                color={BOTANY_COLORS.waterBlue}
                ior={1.33}
                opacity={0.82}
                roughness={0.1}
                transparent
              />
            </mesh>
          </group>
        );
      })}

      {/* Animated ATP mineral ion crystals */}
      {Arr.map(STREAM_OFFSETS, (offset, idx) => {
        const initialPt = geos.ionPath.getPoint((0.2 + offset) % 1);
        return (
          <group
            key={`ion-${offset}`}
            position={[initialPt.x, initialPt.y, initialPt.z]}
            ref={(el) => {
              ionRefs.current[idx] = el;
            }}
          >
            <mesh>
              <octahedronGeometry args={[0.044, 0]} />
              <meshStandardMaterial
                color={BOTANY_COLORS.sucroseGold}
                emissive={BOTANY_COLORS.agarAmber}
                emissiveIntensity={0.28}
                metalness={0.35}
                roughness={0.24}
              />
            </mesh>
          </group>
        );
      })}

      {/* Anatomical callouts */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-1.16, 1.04, 0]}
      >
        <span>{parts.soilWater}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.86, 0.14, 0.34]}
      >
        <span>{parts.rootHair}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.5, 1.12, 0]}
      >
        <span>{parts.epidermis}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.08, 1.12, 0]}
      >
        <span>{parts.cortex}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.68, 0.12, 0.34]}
      >
        <span>{parts.endodermis}</span>
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[1.02, 1.12, 0]}
      >
        <span>{parts.xylem}</span>
      </ThreeLabel>
    </group>
  );
}
