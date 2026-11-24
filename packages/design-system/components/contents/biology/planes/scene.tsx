import { useFrame } from "@react-three/fiber";
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
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, DoubleSide, Vector3 } from "three";

const BODY_CAMERA: readonly [number, number, number] = [1.55, 1.35, 2.55];
const BODY_TARGET: readonly [number, number, number] = [0, 0.88, 0];
const STEM_CAMERA: readonly [number, number, number] = [1.35, 1.15, 1.85];
const STEM_TARGET: readonly [number, number, number] = [0, 0.65, 0];

/**
 * Interactive 3D scene for anatomical planes on a standing human figure
 * (anatomical position, palms facing forward) or a dicot stem section.
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
    (axis.start[0] + axis.end[0]) / 2,
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

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[1.25, 1.25, 0.04, 36]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.cabinet}
          roughness={0.75}
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
                pose.position[0],
                pose.position[1] + 0.45,
                pose.position[2],
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
                slice.position[1] + 0.35,
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

/** Human figure standing in anatomical position with cut plane and directional axis. */
function AnatomicalBody({
  axis,
  pose,
}: {
  readonly axis: PairAxis;
  readonly pose: PlanePose;
}) {
  const axisGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setFromPoints([
      new Vector3(axis.start[0], axis.start[1], axis.start[2]),
      new Vector3(axis.end[0], axis.end[1], axis.end[2]),
    ]);
    return geometry;
  }, [axis]);

  useEffect(() => () => axisGeometry.dispose(), [axisGeometry]);

  return (
    <group>
      <mesh castShadow position={[0, 1.56, 0]}>
        <sphereGeometry args={[0.115, 24, 24]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.tubule} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 1.42, 0]}>
        <cylinderGeometry args={[0.048, 0.055, 0.1, 18]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.tubule} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 1.13, 0]}>
        <capsuleGeometry args={[0.165, 0.3, 12, 24]} />
        <meshStandardMaterial color={LABORATORY_COLORS.mask} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.155, 0.145, 0.16, 20]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.nitrile}
          roughness={0.6}
        />
      </mesh>

      {Arr.map([-1, 1] as const, (side) => (
        <group key={side}>
          <mesh
            castShadow
            position={[side * 0.25, 1.18, 0]}
            rotation={[0, 0, side * 0.18]}
          >
            <capsuleGeometry args={[0.045, 0.22, 10, 16]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.tubule}
              roughness={0.55}
            />
          </mesh>
          <mesh
            castShadow
            position={[side * 0.34, 0.89, 0.02]}
            rotation={[0, 0, side * 0.16]}
          >
            <capsuleGeometry args={[0.038, 0.22, 10, 16]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.tubule}
              roughness={0.55}
            />
          </mesh>
          <mesh castShadow position={[side * 0.4, 0.71, 0.04]}>
            <boxGeometry args={[0.065, 0.09, 0.024]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.tubule}
              roughness={0.55}
            />
          </mesh>
          <mesh castShadow position={[side * 0.095, 0.44, 0]}>
            <capsuleGeometry args={[0.062, 0.56, 10, 18]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.tubule}
              roughness={0.55}
            />
          </mesh>
          <mesh castShadow position={[side * 0.095, 0.04, 0.05]}>
            <boxGeometry args={[0.09, 0.07, 0.2]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.plinth}
              roughness={0.7}
            />
          </mesh>
        </group>
      ))}

      <mesh position={pose.position} rotation={pose.rotation}>
        <planeGeometry args={pose.size} />
        <meshStandardMaterial
          color={PLOT_COLORS.teal}
          opacity={0.32}
          roughness={0.25}
          side={DoubleSide}
          transparent
        />
      </mesh>

      <lineSegments geometry={axisGeometry}>
        <lineBasicMaterial color={PLOT_COLORS.amber} />
      </lineSegments>
      <mesh position={axis.start}>
        <sphereGeometry args={[0.036, 16, 16]} />
        <meshStandardMaterial color={PLOT_COLORS.amber} />
      </mesh>
      <mesh position={axis.end}>
        <sphereGeometry args={[0.036, 16, 16]} />
        <meshStandardMaterial color={PLOT_COLORS.pink} />
      </mesh>
    </group>
  );
}

/** 3D dicot stem showing epidermis, cortex, vascular bundle ring (xylem + phloem), and pith. */
function DicotStem({ slice }: { readonly slice: StemSlice }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 1.15, 32]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.stem}
          opacity={0.42}
          roughness={0.6}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 1.16, 24]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.cutTissue}
          roughness={0.7}
        />
      </mesh>
      {Arr.map(slice.bundles, (angle) => {
        const xIn = Math.cos(angle) * 0.18;
        const zIn = Math.sin(angle) * 0.18;
        const xOut = Math.cos(angle) * 0.24;
        const zOut = Math.sin(angle) * 0.24;
        return (
          <group key={angle}>
            <mesh position={[xIn, 0.65, zIn]}>
              <cylinderGeometry args={[0.026, 0.026, 1.17, 12]} />
              <meshStandardMaterial
                color={BIOLOGY_COLORS.blood}
                roughness={0.5}
              />
            </mesh>
            <mesh position={[xOut, 0.65, zOut]}>
              <cylinderGeometry args={[0.024, 0.024, 1.17, 12]} />
              <meshStandardMaterial
                color={BIOLOGY_COLORS.glucose}
                roughness={0.5}
              />
            </mesh>
          </group>
        );
      })}
      <mesh position={slice.position} rotation={slice.rotation}>
        <planeGeometry args={slice.size} />
        <meshStandardMaterial
          color={PLOT_COLORS.teal}
          opacity={0.34}
          roughness={0.25}
          side={DoubleSide}
          transparent
        />
      </mesh>
    </group>
  );
}
