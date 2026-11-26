import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { prepareAnatomicalScene } from "@repo/design-system/components/contents/biology/anatomy";
import { HRA_BODY_ASSET } from "@repo/design-system/components/contents/biology/assets";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  Pair,
  PairAxis,
  Plane,
  PlanePose,
  Section,
  StemSlice,
  Subject,
} from "@repo/design-system/components/contents/biology/planes/anatomy";
import {
  pairAxis,
  planePose,
  stemSlice,
} from "@repo/design-system/components/contents/biology/planes/anatomy";
import {
  AnatomicalDirectionAxis,
  buildMedullaryRayAngles,
  FramedSectionPlane,
  useDicotStemGeometries,
} from "@repo/design-system/components/contents/biology/planes/geometry";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import { DoubleSide } from "three";

const BODY_CAMERA: readonly [number, number, number] = [1.55, 1.32, 2.58];
const BODY_TARGET: readonly [number, number, number] = [0, 0.88, 0];
const STEM_CAMERA: readonly [number, number, number] = [1.35, 1.15, 1.85];
const STEM_TARGET: readonly [number, number, number] = [0, 0.65, 0];

const BODY_MATERIAL = {
  clearcoat: 0.14,
  clearcoatRoughness: 0.55,
  color: BIOLOGY_COLORS.skinClay,
  roughness: 0.56,
  sheen: 0.36,
  sheenColor: BIOLOGY_COLORS.skinSheen,
  sheenRoughness: 0.62,
} as const;

/**
 * Interactive 3D scene for anatomical planes on a real NIH Human Reference Atlas
 * standing human figure or a multi-tissue botanical dicot stem section.
 */
export function PlanesScene({
  onPosition,
  pair,
  pairLabel,
  plane,
  planeLabel,
  position,
  section,
  sectionLabel,
  subject,
}: {
  readonly onPosition: (value: number) => void;
  readonly pair: Pair;
  readonly pairLabel?: string | undefined;
  readonly plane: Plane;
  readonly planeLabel?: string | undefined;
  readonly position: number;
  readonly section: Section;
  readonly sectionLabel?: string | undefined;
  readonly subject: Subject;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const phase = useRef(Math.asin(Math.max(-1, Math.min(1, position))));
  const lastSent = useRef(position);

  if (!playing) {
    phase.current = Math.asin(Math.max(-1, Math.min(1, position)));
    lastSent.current = position;
  }

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phase.current += simulationStep(delta) * 1.15;
    const next = Math.round(Math.sin(phase.current) * 50) / 50;
    if (Math.abs(next - lastSent.current) >= 0.03) {
      lastSent.current = next;
      onPosition(next);
    }
  });

  const pose = planePose(plane, position);
  const axis = pairAxis(pair);
  const slice = stemSlice(section, position);
  const pairMid: readonly [number, number, number] = [
    (axis.start[0] + axis.end[0]) / 2 + 0.08,
    (axis.start[1] + axis.end[1]) / 2 + 0.08,
    (axis.start[2] + axis.end[2]) / 2,
  ];

  return (
    <group>
      <CameraControls
        cameraPosition={subject === "body" ? BODY_CAMERA : STEM_CAMERA}
        cameraTarget={subject === "body" ? BODY_TARGET : STEM_TARGET}
        fov={38}
      />

      {/* Beveled laboratory museum plinth */}
      <mesh position={[0, -0.025, 0]} receiveShadow>
        <cylinderGeometry args={[1.18, 1.24, 0.05, 48]} />
        <SurfaceMaterial
          bump={0.25}
          color={LABORATORY_COLORS.cabinet}
          roughness={0.72}
          surface="concrete"
        />
      </mesh>

      {subject === "body" ? (
        <group>
          <AnatomicalBody axis={axis} pose={pose} />
          {planeLabel !== undefined && (
            <ThreeLabel
              anchorY="bottom"
              color={ink}
              gap={0.04}
              position={[
                pose.position[0] - 0.34,
                Math.min(1.66, pose.position[1] + 0.72),
                pose.position[2] + 0.12,
              ]}
            >
              {planeLabel}
            </ThreeLabel>
          )}
          {pairLabel !== undefined && (
            <ThreeLabel
              anchorY="bottom"
              color={ink}
              gap={0.04}
              position={pairMid}
            >
              {pairLabel}
            </ThreeLabel>
          )}
        </group>
      ) : (
        <group>
          <DicotStem slice={slice} />
          {sectionLabel !== undefined && (
            <ThreeLabel
              anchorY="bottom"
              color={ink}
              gap={0.05}
              position={[
                slice.position[0],
                slice.position[1] + 0.36,
                slice.position[2],
              ]}
            >
              {sectionLabel}
            </ThreeLabel>
          )}
        </group>
      )}
    </group>
  );
}

/** Real NIH Human Reference Atlas standing human figure with glass cut plane and 3D directional axis. */
function AnatomicalBody({
  axis,
  pose,
}: {
  readonly axis: PairAxis;
  readonly pose: PlanePose;
}) {
  const { scene } = useGLTF(HRA_BODY_ASSET.path);
  const body = useMemo(
    () =>
      prepareAnatomicalScene(scene, {
        fallback: BODY_MATERIAL,
        targetExtent: 1.72,
      }),
    [scene]
  );

  return (
    <group>
      <group position={[0, 0.86, 0]}>
        <primitive object={body} />
      </group>

      {/* Classroom-appropriate fitted anatomical athletic shorts over pelvic region */}
      <group position={[0, 0.86, 0.015]}>
        <mesh castShadow position={[0, 0.02, 0]} scale={[1.12, 1, 0.8]}>
          <cylinderGeometry args={[0.162, 0.172, 0.24, 32]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.plinth}
            roughness={0.8}
          />
        </mesh>
        <mesh
          castShadow
          position={[0, -0.09, 0.015]}
          scale={[1.28, 0.92, 0.92]}
        >
          <sphereGeometry args={[0.105, 24, 18]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.plinth}
            roughness={0.8}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={`short-leg-${side}`}
            position={[side * 0.09, -0.12, 0]}
            scale={[1, 1, 0.96]}
          >
            <cylinderGeometry args={[0.112, 0.098, 0.18, 24]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.plinth}
              roughness={0.8}
            />
          </mesh>
        ))}
      </group>

      <FramedSectionPlane
        color={PLOT_COLORS.teal}
        position={pose.position}
        rotation={pose.rotation}
        size={pose.size}
      />

      <AnatomicalDirectionAxis
        end={axis.end}
        endColor={PLOT_COLORS.pink}
        start={axis.start}
        startColor={PLOT_COLORS.amber}
      />
    </group>
  );
}

/** High-detail botanical dicot stem cutaway showing ridged epidermis, cortex, sclerenchyma, phloem, cambium, xylem, and pith. */
function DicotStem({ slice }: { readonly slice: StemSlice }) {
  const { cambium, cortexRing, epidermis, pith, sclerenchymaCap } =
    useDicotStemGeometries();
  const rayAngles = useMemo(
    () => buildMedullaryRayAngles(slice.bundles),
    [slice.bundles]
  );

  return (
    <group>
      <group position={[0, 0.65, 0]}>
        {/* Outer translucent ridged epidermis */}
        <mesh castShadow geometry={epidermis}>
          <meshPhysicalMaterial
            clearcoat={0.48}
            clearcoatRoughness={0.28}
            depthWrite={false}
            opacity={0.42}
            roughness={0.46}
            side={DoubleSide}
            transparent
            vertexColors
          />
        </mesh>

        {/* Translucent parenchyma cortex body */}
        <mesh geometry={cortexRing}>
          <meshPhysicalMaterial
            color={BIOLOGY_COLORS.stemCortex}
            depthWrite={false}
            opacity={0.24}
            roughness={0.62}
            transparent
          />
        </mesh>

        {/* Meristematic cambium ring connecting collateral vascular bundles */}
        <mesh geometry={cambium}>
          <meshPhysicalMaterial
            color={BIOLOGY_COLORS.stemCambium}
            depthWrite={false}
            opacity={0.32}
            roughness={0.5}
            side={DoubleSide}
            transparent
          />
        </mesh>

        {/* Spongy central parenchymal pith */}
        <mesh castShadow geometry={pith} receiveShadow>
          <SurfaceMaterial
            bump={0.45}
            color={BIOLOGY_COLORS.stemPith}
            roughness={0.74}
            surface="concrete"
          />
        </mesh>

        {/* Radial medullary rays between bundles */}
        {Arr.map(rayAngles, (angle) => (
          <mesh
            key={`ray-${angle}`}
            position={[Math.cos(angle) * 0.175, 0, Math.sin(angle) * 0.175]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[0.1, 1.14, 0.008]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.stemPith}
              opacity={0.48}
              roughness={0.78}
              transparent
            />
          </mesh>
        ))}

        {/* Collateral vascular bundles: protoxylem, metaxylem vessels, phloem, and sclerenchyma cap */}
        {Arr.map(slice.bundles, (angle) => {
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          return (
            <group key={`bundle-${angle}`}>
              {/* Protoxylem (innermost narrow vessel) */}
              <mesh position={[cos * 0.158, 0, sin * 0.158]}>
                <cylinderGeometry args={[0.012, 0.012, 1.175, 10]} />
                <meshPhysicalMaterial
                  clearcoat={0.35}
                  color={BIOLOGY_COLORS.stemXylem}
                  roughness={0.4}
                />
              </mesh>
              {/* Metaxylem (paired larger lignified vessels) */}
              <mesh
                position={[
                  cos * 0.188 - sin * 0.015,
                  0,
                  sin * 0.188 + cos * 0.015,
                ]}
              >
                <cylinderGeometry args={[0.018, 0.018, 1.178, 12]} />
                <meshPhysicalMaterial
                  clearcoat={0.38}
                  color={BIOLOGY_COLORS.stemXylem}
                  roughness={0.38}
                />
              </mesh>
              <mesh
                position={[
                  cos * 0.188 + sin * 0.015,
                  0,
                  sin * 0.188 - cos * 0.015,
                ]}
              >
                <cylinderGeometry args={[0.018, 0.018, 1.178, 12]} />
                <meshPhysicalMaterial
                  clearcoat={0.38}
                  color={BIOLOGY_COLORS.stemXylem}
                  roughness={0.38}
                />
              </mesh>
              {/* Phloem sieve tube cluster (outer side of cambium) */}
              <mesh position={[cos * 0.236, 0, sin * 0.236]}>
                <cylinderGeometry args={[0.026, 0.026, 1.176, 14]} />
                <meshPhysicalMaterial
                  clearcoat={0.3}
                  color={BIOLOGY_COLORS.stemPhloem}
                  roughness={0.44}
                />
              </mesh>
              {/* Fibrous sclerenchyma bundle cap */}
              <mesh
                geometry={sclerenchymaCap}
                position={[cos * 0.248, 0, sin * 0.248]}
                rotation={[0, -angle, 0]}
              >
                <meshStandardMaterial
                  color={BIOLOGY_COLORS.stemSclerenchyma}
                  roughness={0.62}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      <FramedSectionPlane
        color={PLOT_COLORS.teal}
        position={slice.position}
        rotation={slice.rotation}
        size={slice.size}
      />
    </group>
  );
}

useGLTF.preload(HRA_BODY_ASSET.path);
