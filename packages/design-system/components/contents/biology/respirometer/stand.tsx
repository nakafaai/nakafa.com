import { RoundedBox } from "@react-three/drei";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { RESPIROMETER_COLORS } from "@repo/design-system/lib/material/respirometer";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";

/**
 * A retort stand, in metres: a 200 × 125 × 2.5 mm pressed steel base and a
 * 600 × 12 mm rod (Rapid Electronics 52-1305 data sheet).
 */
export const STAND = {
  base: { depth: 0.2, thickness: 0.0025, width: 0.125 },
  rod: { length: 0.6, radius: 0.006 },
} as const;

/** How far the rod stands in from the back edge of the base, in metres. */
const ROD_INSET = 0.025;

/**
 * A retort stand with its rod at the origin: the base runs forward from
 * behind the rod along +z, with a raised boss the rod screws into.
 */
export function RetortStand() {
  return (
    <group>
      <RoundedBox
        args={[STAND.base.width, STAND.base.thickness, STAND.base.depth]}
        castShadow
        position={[
          0,
          STAND.base.thickness / 2,
          STAND.base.depth / 2 - ROD_INSET,
        ]}
        radius={0.001}
        receiveShadow
        smoothness={2}
      >
        <meshPhysicalMaterial
          clearcoat={0.5}
          clearcoatRoughness={0.35}
          color={RESPIROMETER_COLORS.standBase}
          metalness={0.2}
          roughness={0.45}
        />
      </RoundedBox>
      <mesh castShadow position={[0, STAND.base.thickness + 0.004, 0]}>
        <cylinderGeometry args={[0.011, 0.013, 0.008, 28]} />
        <MetalMaterial color={RESPIROMETER_COLORS.clampBody} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, STAND.rod.length / 2, 0]}>
        <cylinderGeometry
          args={[STAND.rod.radius, STAND.rod.radius, STAND.rod.length, 24]}
        />
        <MetalMaterial color={RESPIROMETER_COLORS.rod} roughness={0.18} />
      </mesh>
    </group>
  );
}

/** A clamp's arm and boss head, in metres: the arm's radius and how far beside the rod it runs. */
export const ARM = { offset: 0.0135, radius: 0.005 } as const;

/**
 * A boss head on the stand's rod at `height`, its arm reaching out
 * horizontally beside the rod towards `target` (x and z from the rod's
 * axis) and stopping `stop` short of it, where the jaws take over, and
 * `children` drawn at the target with +z pointing along the arm.
 */
export function BossArm({
  children,
  height,
  stop,
  target,
}: {
  readonly children: ReactNode;
  readonly height: number;
  readonly stop: number;
  readonly target: readonly [number, number];
}) {
  const distance = Math.hypot(...target);
  const reach = Math.sqrt(distance ** 2 - ARM.offset ** 2);
  const yaw =
    Math.atan2(target[0], target[1]) + Math.asin(ARM.offset / distance);
  const arm = reach - stop + 0.012;
  return (
    <group position={[0, height, 0]} rotation={[0, yaw, 0]}>
      <RoundedBox
        args={[0.034, 0.026, 0.024]}
        castShadow
        position={[-ARM.offset / 2 + 0.0005, 0, 0]}
        radius={0.002}
        smoothness={2}
      >
        <MetalMaterial color={RESPIROMETER_COLORS.clampBody} roughness={0.45} />
      </RoundedBox>
      <Screw
        position={[-ARM.offset / 2, 0, -0.012]}
        turn={[-Math.PI / 2, 0, 0]}
      />
      <Screw
        position={[-ARM.offset / 2 - 0.0165, 0, 0]}
        turn={[0, 0, Math.PI / 2]}
      />
      <mesh
        castShadow
        position={[-ARM.offset, 0, arm / 2 - 0.012]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[ARM.radius, ARM.radius, arm, 18]} />
        <MetalMaterial color={RESPIROMETER_COLORS.rod} roughness={0.22} />
      </mesh>
      <group position={[-ARM.offset, 0, reach]}>{children}</group>
    </group>
  );
}

/** A thumbscrew standing out of a boss head along its own y axis, turned by `turn`. */
function Screw({
  position,
  turn,
}: {
  readonly position: readonly [number, number, number];
  readonly turn: readonly [number, number, number];
}) {
  return (
    <group position={position} rotation={turn}>
      <mesh position={[0, 0.004, 0]}>
        <cylinderGeometry args={[0.0022, 0.0022, 0.008, 12]} />
        <MetalMaterial color={RESPIROMETER_COLORS.rod} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.0095, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.004, 20]} />
        <meshStandardMaterial
          color={RESPIROMETER_COLORS.jaw}
          roughness={0.55}
        />
      </mesh>
    </group>
  );
}

/** The radius of a tube clamp's padded prongs, in metres. */
const JAW_PAD = 0.0018;

/** How far short of a tube's axis a clamp's arm stops for its yoke and prongs, around a tube of radius `grip`. */
export function tubeStop(grip: number) {
  return grip + JAW_PAD * 2 + 0.008;
}

/**
 * The two padded prongs of a clamp closed round an upright tube of outer
 * radius `grip`, centred on the end of the arm: a back prong the arm holds
 * and a front prong hinged to it, drawn short of each other at the sides
 * where the wing screw closes them.
 */
export function TubeJaws({ grip }: { readonly grip: number }) {
  const pad = JAW_PAD;
  return (
    <group>
      {Arr.map([0, Math.PI] as const, (start) => (
        <mesh
          castShadow
          key={start}
          rotation={[Math.PI / 2, 0, start + Math.PI * 0.08]}
        >
          <torusGeometry
            args={[grip + pad + 0.0001, pad, 10, 32, Math.PI * 0.84]}
          />
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={RESPIROMETER_COLORS.jaw}
            roughness={0.6}
          />
        </mesh>
      ))}
      <mesh position={[0, 0, -grip - pad * 2 - 0.004]}>
        <boxGeometry args={[0.012, 0.008, 0.008]} />
        <MetalMaterial color={RESPIROMETER_COLORS.clampBody} roughness={0.45} />
      </mesh>
    </group>
  );
}

/**
 * Two flat rubber pads pressed on either face of a board `thickness` thick
 * whose back face lies at the end of the arm, joined over its top edge by a
 * steel yoke, `drop` below which the pads reach.
 */
export function BoardJaws({
  drop,
  thickness,
}: {
  readonly drop: number;
  readonly thickness: number;
}) {
  return (
    <group>
      {Arr.map([-0.0016, thickness + 0.0016] as const, (depth) => (
        <RoundedBox
          args={[0.016, drop, 0.0032]}
          castShadow
          key={depth}
          position={[0, -drop / 2 + 0.002, depth]}
          radius={0.0012}
          smoothness={2}
        >
          <meshStandardMaterial
            color={RESPIROMETER_COLORS.jaw}
            roughness={0.7}
          />
        </RoundedBox>
      ))}
      <mesh castShadow position={[0, 0.0035, thickness / 2]}>
        <boxGeometry args={[0.016, 0.003, thickness + 0.0064]} />
        <MetalMaterial color={RESPIROMETER_COLORS.clampBody} roughness={0.45} />
      </mesh>
    </group>
  );
}
