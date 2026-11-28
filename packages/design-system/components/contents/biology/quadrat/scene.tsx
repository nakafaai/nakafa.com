import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  useFernRosette,
  useFoliageMaterial,
  useMossCushion,
} from "@repo/design-system/components/contents/biology/flora";
import { useCloverCluster } from "@repo/design-system/components/contents/biology/quadrat/clover";
import type {
  QuadratOrganism,
  SamplingMethod,
} from "@repo/design-system/components/contents/biology/quadrat/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import type { Blade } from "@repo/design-system/components/three/flora/blade";
import { Foliage } from "@repo/design-system/components/three/flora/foliage";
import { growSward } from "@repo/design-system/components/three/flora/habit";
import { Tree } from "@repo/design-system/components/three/flora/tree";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOME_COLORS } from "@repo/design-system/lib/material/biome";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
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

/** One blade of meadow grass: narrow, keeled along its midrib and arching to its tip. */
const GRASS: Blade = {
  arch: 0.38,
  columns: 2,
  fold: 0.55,
  length: 1,
  outline: "linear",
  relief: 0,
  rows: 6,
  teeth: 0,
  veins: 1,
  wave: 0,
  width: 0.075,
};

const SUBGRID_OFFSETS = [-0.21, -0.07, 0.07, 0.21] as const;
const TAPE_TICKS = Arr.makeBy(11, (i) => -1.1 + i * 0.22);

/** What the camera fills the frame with: the surveyed plots, the tape across them and the flag at its end. */
const SURVEY = {
  x: { max: 1.2, min: -1.2 },
  y: { max: 0.3, min: 0 },
  z: { max: 1.1, min: -1.1 },
} as const;

/** Whether the lab is shown on a narrow screen, where a label that would touch its subject is left out. */
function useNarrow() {
  return isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
}

function QuadratCamera() {
  return (
    <CameraControls
      cameraPosition={[0.3, 3.4, 3]}
      cameraTarget={[-0.08, 0.34, -0.1]}
      fov={36}
      framing="content"
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
  const sward = useMemo(
    () => growSward({ blade: 0.04, count: 24_000, radius: 3.2, seed: 5 }),
    []
  );
  const foliageMat = useFoliageMaterial();
  const ink = useLabelInk();
  const narrow = useNarrow();

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

      <CameraBounds bounds={SURVEY}>
        {/* Fiberglass surveyor transect measuring tape with metric black ticks */}
        <group position={[0, 0.046, 0]}>
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
          <mesh castShadow position={[-1.24, 0.026, 0]}>
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
      </CameraBounds>

      {/* Authentic timber 1m^2 field quadrat frame with brass corners & taut nylon sub-grid */}
      {/* The frame steps from plot to plot inside the survey, so the camera leaves it out of its fit */}
      <CameraBounds exclude>
        <group position={[activePlot.x, 0.021, activePlot.z]} ref={frameRef}>
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
                <MetalMaterial
                  color={BIOME_COLORS.brassMetal}
                  roughness={0.34}
                />
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
      </CameraBounds>

      {/* The meadow the survey stands in: grass in tufts, stirring in the wind */}
      <CameraBounds exclude>
        <Foliage
          blade={GRASS}
          deep={FLORA_COLORS.grassDeep}
          leaves={sward}
          sun={FLORA_COLORS.grassTip}
          sway={0.16}
        />
      </CameraBounds>

      {/* The shade tree at the field's edge, whose canopy changes what grows under it */}
      <CameraBounds exclude>
        <group position={[-1.18, 0, -1.08]} scale={0.74}>
          <Tree habit="broadleaf" seed={24} />
        </group>
      </CameraBounds>

      <CameraBounds bounds={SURVEY}>
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
      </CameraBounds>

      {/* Labels */}
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[activePlot.x, 0.36, activePlot.z + 0.44]}
      >
        <span>{parts.quadratFrame}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-0.28, 0.28, -0.24]}
      >
        <span>{parts.transectLine}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-0.42, 1.32, -1.08]}
      >
        <span>{parts.canopy}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[1.32, 0.64, 0]}
        visible={!narrow}
      >
        <span>{parts.markerFlag}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ink}
        fontSize="compact"
        position={[-0.85, 0.22, 1.12]}
        visible={!narrow}
      >
        <span>{parts.gridPlot}</span>
      </ThreeLabel>
    </group>
  );
}
