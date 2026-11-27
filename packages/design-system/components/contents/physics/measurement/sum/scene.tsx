import type { CopperToolSchema } from "@repo/design-system/components/contents/physics/measurement/sum/rods";
import {
  COPPER_LENGTH,
  IRON_LENGTH,
  joinedRods,
} from "@repo/design-system/components/contents/physics/measurement/sum/rods";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Turn } from "@repo/design-system/components/three/form/part";
import { Rule } from "@repo/design-system/components/three/instrument/rule";
import { MILLIMETRE } from "@repo/design-system/components/three/instrument/scale";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import type { ReactNode } from "react";

/** The instrument the copper rod was read with. */
type Tool = typeof CopperToolSchema.Type;

/** How far the rule's scale runs, in centimetres. */
const SCALE = 15;

/** The radius of both rods and the chamfer on their ends, in scene units. */
const ROD = { chamfer: 0.5 * MILLIMETRE, radius: 4 * MILLIMETRE } as const;

/** How far behind the rule's graduated edge the rods' axis lies, in scene units. */
const BEHIND = ROD.radius + 0.6 * MILLIMETRE;

/** Where the zero mark of the rule lies on the bench, so the scale is centred, in scene units. */
const ZERO = (-SCALE * 10 * MILLIMETRE) / 2;

/**
 * What the camera frames at every width, in scene units: the joined end of
 * the rods against the stretch of the scale it is read on, from 11.3 cm to
 * 13.9 cm, with the numerals of that stretch. The sum is decided within a
 * millimetre of that end, so the camera comes close enough to read it, and a
 * reader pulls back to see both rods.
 */
const READING = {
  x: { max: ZERO + 139 * MILLIMETRE, min: ZERO + 113 * MILLIMETRE },
  y: { max: 2 * ROD.radius, min: 0 },
  z: { max: 14 * MILLIMETRE, min: -BEHIND - ROD.radius },
} as const;

/** Where the camera looks, in scene units: the middle of that stretch, at the rule's edge. */
const AIM = [ZERO + 126 * MILLIMETRE, 0.02, 0.02] as const;

/** The outline of a rod `long` scene units long, turned about its axis, with a chamfer on both ends. */
function rodOutline(long: number) {
  return [
    [0, 0],
    [ROD.radius - ROD.chamfer, 0],
    [ROD.radius, ROD.chamfer],
    [ROD.radius, long - ROD.chamfer],
    [ROD.radius - ROD.chamfer, long],
    [0, long],
  ] as const;
}

/**
 * A drawn rod lying along the rule's edge from `from` centimetres on its
 * scale, `long` centimetres long. Its child is the metal it is drawn from.
 */
function Rod({
  children,
  from,
  long,
}: {
  readonly children: ReactNode;
  readonly from: number;
  readonly long: number;
}) {
  return (
    <mesh
      castShadow
      position={[from * 10 * MILLIMETRE, ROD.radius, -BEHIND]}
      receiveShadow
      rotation={[0, 0, -Math.PI / 2]}
    >
      <Turn profile={rodOutline(long * 10 * MILLIMETRE)} />
      {children}
    </mesh>
  );
}

/** A glowing mark in the lesson's colour, see-through when it is a band. */
function Glow({
  color,
  opacity,
}: {
  readonly color: string;
  readonly opacity: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      depthWrite={opacity === 1}
      emissive={color}
      emissiveIntensity={0.5}
      opacity={opacity}
      roughness={0.5}
      transparent={opacity < 1}
    />
  );
}

/**
 * An iron rod and a copper rod laid end to end along a steel rule, seen
 * close on the joined end, which is marked: the band where it may really lie, which the coarser
 * reading sets, the sum as a calculator writes it, and the sum rounded to
 * the decimals that band allows, picked out on the rule's scale.
 *
 * @param tool - The instrument the copper rod was read with
 */
export function JoinScene({ tool }: { readonly tool: Tool }) {
  const { raw, reported, spread } = joinedRods(tool);

  return (
    <group>
      <CameraControls
        cameraPosition={[AIM[0], AIM[1] + 0.82, AIM[2] + 0.57]}
        cameraTarget={[AIM[0], AIM[1], AIM[2]]}
        fov={36}
        framing="content"
        maxPolarAngle={Math.PI * 0.49}
      />
      <CameraBounds bounds={READING}>
        <group position={[ZERO, 0, 0]}>
          <Rule length={SCALE} />
          <Rod from={0} long={IRON_LENGTH}>
            <SurfaceMaterial
              bump={0.35}
              color={INSTRUMENT_COLORS.iron}
              metalness={0.8}
              repeat={[40, 4]}
              roughness={0.46}
              surface="brushed"
            />
          </Rod>
          <Rod from={IRON_LENGTH} long={COPPER_LENGTH}>
            <SurfaceMaterial
              bump={0.3}
              color={INSTRUMENT_COLORS.copper}
              metalness={0.8}
              repeat={[40, 4]}
              roughness={0.32}
              surface="brushed"
            />
          </Rod>
          <group scale={MILLIMETRE}>
            <mesh position={[raw * 10, 7, -1]}>
              <boxGeometry args={[spread * 20, 14, 22]} />
              <Glow color={PLOT_COLORS.teal} opacity={0.4} />
            </mesh>
            <mesh position={[raw * 10, 7.5, -1]}>
              <boxGeometry args={[0.07, 15, 23]} />
              <Glow color={PLOT_COLORS.violet} opacity={1} />
            </mesh>
            <mesh position={[reported * 10, 1, 4.6]}>
              <boxGeometry args={[0.3, 0.16, 9.2]} />
              <Glow color={PLOT_COLORS.fuchsia} opacity={1} />
            </mesh>
          </group>
        </group>
      </CameraBounds>
    </group>
  );
}
