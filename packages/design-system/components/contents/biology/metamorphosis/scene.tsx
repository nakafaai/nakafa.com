import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { leafBlade } from "@repo/design-system/components/contents/biology/flora";
import type { Insect } from "@repo/design-system/components/contents/biology/metamorphosis/growth";
import {
  growthAt,
  lengthCurvePoints,
} from "@repo/design-system/components/contents/biology/metamorphosis/growth";
import { MetamorphosisOrganism } from "@repo/design-system/components/contents/biology/metamorphosis/stages";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  TubeGeometry,
  Vector3,
} from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.9, 2.42];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];

export type MetamorphosisPart =
  | "exoskeleton"
  | "exuvia"
  | "wingBud"
  | "wing"
  | "headCapsule"
  | "leaf";

/**
 * 3D insect metamorphosis scene: sculpted botanical host leaf supporting the
 * developing insect (egg -> larva/nymph -> pupa -> winged adult) with shed
 * exuvia during moults and a 3D stepped exoskeleton growth chart in the back.
 */
export function MetamorphosisScene({
  insect,
  onTime,
  parts,
  time,
}: {
  readonly insect: Insect;
  readonly onTime: (next: number) => void;
  readonly parts: Readonly<Record<MetamorphosisPart, string>>;
  readonly time: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const clock = useRef(time);
  const lastSent = useRef(time);

  useVisualStop(() => {
    clock.current = 0;
    lastSent.current = 0;
    onTime(0);
  });

  if (!playing) {
    clock.current = time;
    lastSent.current = time;
  }

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current = (clock.current + simulationStep(delta) * 0.1) % 1;
    if (Math.abs(clock.current - lastSent.current) >= 0.015) {
      lastSent.current = clock.current;
      onTime(Math.round(clock.current * 100) / 100);
    }
  });

  const snap = growthAt(insect, time);
  const bodyScale = 0.52 + (snap.lengthMm / 42) * 0.72;
  const cursorX = -0.85 + time * 1.7;

  const { curveTube, hostLeafGeo, midribGeo } = useMemo(() => {
    const pts = Arr.map(
      lengthCurvePoints(insect),
      ([x, y, z]) => new Vector3(x, y, z)
    );
    const tube = new TubeGeometry(
      new CatmullRomCurve3(pts, false, "centripetal", 0.08),
      64,
      0.011,
      8,
      false
    );
    const leaf = leafBlade(
      new Vector3(-0.74, 0.08, 0.2),
      0,
      0.08,
      1.48,
      0.74,
      0.06,
      12,
      new Color(BOTANY_COLORS.sepalGreen),
      new Color(BOTANY_COLORS.healthyLeaf)
    );
    leaf.rotateX(0.24);
    const rib = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(-0.88, 0.06, 0.2),
        new Vector3(-0.35, 0.1, 0.2),
        new Vector3(0.25, 0.11, 0.2),
        new Vector3(0.68, 0.08, 0.2),
      ]),
      20,
      0.014,
      8,
      false
    );
    return { curveTube: tube, hostLeafGeo: leaf, midribGeo: rib };
  }, [insect]);

  useEffect(
    () => () => {
      curveTube.dispose();
      hostLeafGeo.dispose();
      midribGeo.dispose();
    },
    [curveTube, hostLeafGeo, midribGeo]
  );

  return (
    <group>
      <SimulationTicker running={playing} />
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      {/* Laboratory stone bench */}
      <mesh position={[0, -0.025, 0.04]} receiveShadow>
        <boxGeometry args={[2.3, 0.05, 1.15]} />
        <SurfaceMaterial
          bump={0.22}
          color={LABORATORY_COLORS.cabinet}
          roughness={0.72}
          surface="concrete"
        />
      </mesh>

      {/* Frosted glass stepped exoskeleton growth chart */}
      <group position={[0, 0.84, -0.26]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.94, 0.64, 0.036]} />
          <meshPhysicalMaterial
            clearcoat={0.7}
            color={LABORATORY_COLORS.paper}
            opacity={0.9}
            roughness={0.28}
            transparent
          />
        </mesh>
        <mesh position={[0, -0.33, 0.005]}>
          <boxGeometry args={[1.98, 0.024, 0.052]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.plinth}
            metalness={0.35}
            roughness={0.45}
          />
        </mesh>
      </group>
      <mesh geometry={curveTube} position={[0, 0.02, 0.01]}>
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={PLOT_COLORS.teal}
          emissive={PLOT_COLORS.teal}
          emissiveIntensity={0.2}
          roughness={0.26}
        />
      </mesh>
      <mesh position={[cursorX, 0.84, -0.21]}>
        <boxGeometry args={[0.014, 0.58, 0.024]} />
        <meshPhysicalMaterial
          clearcoat={0.75}
          color={PLOT_COLORS.amber}
          roughness={0.22}
        />
      </mesh>

      {/* Sculpted veined botanical host leaf */}
      <mesh castShadow geometry={hostLeafGeo} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.36}
          clearcoatRoughness={0.34}
          roughness={0.46}
          side={DoubleSide}
          vertexColors
        />
      </mesh>
      <mesh castShadow geometry={midribGeo}>
        <meshStandardMaterial
          color={BOTANY_COLORS.sepalGreen}
          roughness={0.54}
        />
      </mesh>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.66, 0.25, 0.42]}>
        <span>{parts.leaf}</span>
      </ThreeLabel>

      {/* Sculpted developing insect stage */}
      <group position={[0, 0.14, 0.2]} scale={bodyScale}>
        <MetamorphosisOrganism
          insect={insect}
          instar={snap.instar}
          stage={snap.stage}
        />
      </group>

      {/* Translucent shed exuvia cuticle beside insect during ecdysis */}
      {snap.shedding ? (
        <group position={[-0.48, 0.16, 0.26]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.048, 0.16, 10, 14]} />
            <meshPhysicalMaterial
              clearcoat={0.65}
              color={BIOLOGY_COLORS.bean}
              opacity={0.48}
              roughness={0.32}
              transparent
            />
          </mesh>
          <ThreeLabel
            anchorY="bottom"
            color={ink}
            gap={0.04}
            position={[0, 0.12, 0]}
          >
            {parts.exuvia}
          </ThreeLabel>
        </group>
      ) : null}
    </group>
  );
}
