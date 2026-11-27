import { useFrame, useThree } from "@react-three/fiber";
import { useBroadleafTree } from "@repo/design-system/components/contents/biology/canopy";
import {
  useCloverCluster,
  useFernRosette,
  useFoliageMaterial,
  useMossCushion,
} from "@repo/design-system/components/contents/biology/flora";
import type {
  QuadratOrganism,
  SamplingMethod,
} from "@repo/design-system/components/contents/biology/quadrat/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOME_COLORS } from "@repo/design-system/lib/material/biome";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const PLOTS = [
  { id: "p0", x: -0.82, yaw: 0.2, z: -0.82 },
  { id: "p1", x: 0, yaw: 1.1, z: -0.82 },
  { id: "p2", x: 0.82, yaw: 2.3, z: -0.82 },
  { id: "p3", x: -0.82, yaw: 0.8, z: 0 },
  { id: "p4", x: 0, yaw: 1.7, z: 0 },
  { id: "p5", x: 0.82, yaw: 2.9, z: 0 },
  { id: "p6", x: -0.82, yaw: 0.5, z: 0.82 },
  { id: "p7", x: 0, yaw: 1.9, z: 0.82 },
  { id: "p8", x: 0.82, yaw: 2.6, z: 0.82 },
] as const;

const SUBGRID_OFFSETS = [-0.21, -0.07, 0.07, 0.21] as const;
const TAPE_TICKS = Arr.makeBy(11, (i) => -1.1 + i * 0.22);

function QuadratCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.42, 2.35, 4.0] : [0.36, 2.08, 3.45]}
      cameraTarget={[-0.08, 0.34, -0.1]}
      fov={36}
      maxDistance={6.6}
      minDistance={1.4}
    />
  );
}

export function QuadratSamplingScene({
  method,
  organism,
  parts,
  quadratCount,
}: {
  readonly method: SamplingMethod;
  readonly organism: QuadratOrganism;
  readonly parts: Readonly<
    Record<
      "canopy" | "gridPlot" | "markerFlag" | "quadratFrame" | "transectLine",
      string
    >
  >;
  readonly quadratCount: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const frameRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const clover = useCloverCluster(21);
  const fern = useFernRosette(22);
  const moss = useMossCushion(23);
  const canopyTree = useBroadleafTree(24);
  const foliageMat = useFoliageMaterial();

  useFrame((_, delta) => {
    if (!playing || frameRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.4;
    const idx = Math.floor(phaseRef.current) % PLOTS.length;
    const plot = method === "beltTransect" ? PLOTS[(idx % 3) + 3] : PLOTS[idx];
    frameRef.current.position.x = plot.x;
    frameRef.current.position.z = plot.z;
  });

  const sampledCount = Math.min(
    PLOTS.length,
    Math.max(2, Math.round(quadratCount / 2))
  );
  const activePlot =
    method === "beltTransect" ? PLOTS[4] : PLOTS[sampledCount % PLOTS.length];
  let specimenGeometry = moss;
  if (organism === "clover") {
    specimenGeometry = clover;
  } else if (organism === "fern") {
    specimenGeometry = fern;
  }

  return (
    <group>
      <SimulationTicker running={playing} />
      <QuadratCamera />

      {/* Fiberglass surveyor transect measuring tape with metric black ticks */}
      <group position={[0, 0.014, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[2.52, 0.008, 0.068]} />
          <meshStandardMaterial
            color={BIOME_COLORS.transectYellow}
            opacity={method === "beltTransect" ? 1 : 0.45}
            roughness={0.42}
            transparent={method !== "beltTransect"}
          />
        </mesh>
        {Arr.map(TAPE_TICKS, (tx) => (
          <mesh key={`tick-${tx}`} position={[tx, 0.006, 0]}>
            <boxGeometry args={[0.012, 0.003, 0.056]} />
            <meshStandardMaterial
              color={BIOME_COLORS.transectBlack}
              opacity={method === "beltTransect" ? 0.9 : 0.35}
              transparent={method !== "beltTransect"}
            />
          </mesh>
        ))}
        {/* Steel anchor pegs holding the tape taut */}
        <mesh castShadow position={[-1.24, 0.06, 0]}>
          <cylinderGeometry args={[0.012, 0.006, 0.14, 10]} />
          <MetalMaterial color={BIOME_COLORS.wireSteel} roughness={0.35} />
        </mesh>
      </group>

      {/* Botanically sculpted plant specimens across meadow plots + surveyor sample pin flags */}
      {Arr.map(PLOTS, (plot, index) => {
        const isSampled =
          method === "beltTransect"
            ? Math.abs(plot.z) < 0.1
            : index < sampledCount;
        return (
          <group key={plot.id} position={[plot.x, 0, plot.z]}>
            <mesh
              castShadow
              geometry={specimenGeometry}
              material={foliageMat}
              receiveShadow
              rotation={[0, plot.yaw, 0]}
              scale={organism === "fern" ? 0.92 : 1.15}
            />
            {isSampled ? (
              <group position={[0.27, 0, 0.22]}>
                <mesh castShadow position={[0, 0.14, 0]}>
                  <cylinderGeometry args={[0.004, 0.004, 0.28, 6]} />
                  <MetalMaterial
                    color={BIOME_COLORS.wireSteel}
                    roughness={0.3}
                  />
                </mesh>
                <mesh
                  castShadow
                  position={[0.045, 0.24, 0]}
                  rotation={[0, 0.15, 0]}
                >
                  <boxGeometry args={[0.088, 0.052, 0.004]} />
                  <meshStandardMaterial
                    color={BIOME_COLORS.transectYellow}
                    roughness={0.45}
                  />
                </mesh>
              </group>
            ) : null}
          </group>
        );
      })}

      {/* Authentic timber 1m^2 field quadrat frame with brass corners & taut nylon sub-grid */}
      <group position={[activePlot.x, 0.045, activePlot.z]} ref={frameRef}>
        {/* Four textured wood rails */}
        <mesh castShadow position={[0, 0, -0.35]} receiveShadow>
          <boxGeometry args={[0.74, 0.042, 0.042]} />
          <SurfaceMaterial
            bump={0.6}
            color={BIOME_COLORS.quadratWood}
            repeat={[3, 1]}
            roughness={0.65}
            surface="wood"
          />
        </mesh>
        <mesh castShadow position={[0, 0, 0.35]} receiveShadow>
          <boxGeometry args={[0.74, 0.042, 0.042]} />
          <SurfaceMaterial
            bump={0.6}
            color={BIOME_COLORS.quadratWood}
            repeat={[3, 1]}
            roughness={0.65}
            surface="wood"
          />
        </mesh>
        <mesh castShadow position={[-0.35, 0, 0]} receiveShadow>
          <boxGeometry args={[0.042, 0.042, 0.74]} />
          <SurfaceMaterial
            bump={0.6}
            color={BIOME_COLORS.quadratWood}
            repeat={[1, 3]}
            roughness={0.65}
            surface="wood"
          />
        </mesh>
        <mesh castShadow position={[0.35, 0, 0]} receiveShadow>
          <boxGeometry args={[0.042, 0.042, 0.74]} />
          <SurfaceMaterial
            bump={0.6}
            color={BIOME_COLORS.quadratWood}
            repeat={[1, 3]}
            roughness={0.65}
            surface="wood"
          />
        </mesh>
        {/* Brass corner reinforcement brackets */}
        {Arr.map(
          [
            [-0.35, -0.35],
            [0.35, -0.35],
            [-0.35, 0.35],
            [0.35, 0.35],
          ] as const,
          ([cx, cz]) => (
            <mesh key={`corner-${cx}-${cz}`} position={[cx, 0.004, cz]}>
              <boxGeometry args={[0.054, 0.048, 0.054]} />
              <MetalMaterial color={BIOME_COLORS.brassMetal} roughness={0.34} />
            </mesh>
          )
        )}
        {/* Internal 5x5 taut white nylon sub-grid strings */}
        {Arr.map(SUBGRID_OFFSETS, (off) => (
          <group key={`grid-${off}`}>
            <mesh position={[0, 0.008, off]}>
              <boxGeometry args={[0.68, 0.004, 0.004]} />
              <meshStandardMaterial
                color={BIOME_COLORS.boneIvory}
                roughness={0.6}
              />
            </mesh>
            <mesh position={[off, 0.008, 0]}>
              <boxGeometry args={[0.004, 0.004, 0.68]} />
              <meshStandardMaterial
                color={BIOME_COLORS.boneIvory}
                roughness={0.6}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Realistic spreading broadleaf shade canopy tree at upper-left field edge */}
      <group position={[-1.18, 0, -1.08]} scale={1.15}>
        <mesh castShadow geometry={canopyTree.trunk} receiveShadow>
          <SurfaceMaterial
            bump={0.95}
            color={BIOME_COLORS.barkWarm}
            repeat={[2, 4]}
            roughness={0.9}
            surface="bark"
          />
        </mesh>
        <mesh
          castShadow
          geometry={canopyTree.foliage}
          material={foliageMat}
          receiveShadow
        />
      </group>

      {/* Primary orange surveyor boundary pin flag at east end of transect */}
      <group position={[1.26, 0, 0]}>
        <mesh castShadow position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.5, 8]} />
          <MetalMaterial color={BIOME_COLORS.wireSteel} roughness={0.28} />
        </mesh>
        <mesh castShadow position={[0.1, 0.44, 0]} rotation={[0, -0.18, 0]}>
          <boxGeometry args={[0.19, 0.11, 0.008]} />
          <meshPhysicalMaterial
            clearcoat={0.25}
            color={BIOME_COLORS.predatorOrange}
            roughness={0.42}
          />
        </mesh>
      </group>

      {/* Labels */}
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[activePlot.x, 0.36, activePlot.z + 0.44]}
      >
        <span>{parts.quadratFrame}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.28, 0.28, -0.24]}
      >
        <span>{parts.transectLine}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.44, 1.06, -0.95]}
      >
        <span>{parts.canopy}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[1.32, 0.64, 0]}
      >
        <span>{parts.markerFlag}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.85, 0.22, 1.12]}
      >
        <span>{parts.gridPlot}</span>
      </ThreeLabel>
    </group>
  );
}
