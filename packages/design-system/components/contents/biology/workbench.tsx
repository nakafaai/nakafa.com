import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Quaternion, Shape, Vector3 } from "three";

const UP_AXIS = new Vector3(0, 1, 0);

function createRoundedPlateGeometry(
  width: number,
  depth: number,
  height: number
) {
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(0.06, hw * 0.18, hd * 0.18);
  const shape = new Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    depth: height,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * Bevelled dark anodized specimen pedestal with turned brass feet and inlaid
 * brass perimeter rail, grounding laboratory specimens above the seamless bench.
 */
export function SpecimenPedestal({
  depth = 0.92,
  height = 0.055,
  position = [0, 0, 0],
  width = 1.92,
}: {
  readonly depth?: number;
  readonly height?: number;
  readonly position?: readonly [number, number, number];
  readonly width?: number;
}) {
  const body = useMemo(
    () => createRoundedPlateGeometry(width, depth, height),
    [depth, height, width]
  );
  useEffect(() => () => body.dispose(), [body]);

  const fx = width / 2 - 0.14;
  const fz = depth / 2 - 0.12;
  const feet = [
    [-fx, -fz],
    [fx, -fz],
    [-fx, fz],
    [fx, fz],
  ] as const;

  return (
    <group position={position}>
      {Arr.map(feet, ([x, z]) => (
        <mesh castShadow key={`${x}-${z}`} position={[x, 0.012, z]}>
          <cylinderGeometry args={[0.042, 0.048, 0.024, 24]} />
          <MetalMaterial
            color={GENETICS_COLORS.brassPolished}
            roughness={0.28}
          />
        </mesh>
      ))}
      <mesh castShadow geometry={body} position={[0, 0.026, 0]} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.4}
          clearcoatRoughness={0.28}
          color={GENETICS_COLORS.slatePlinth}
          metalness={0.48}
          roughness={0.36}
        />
      </mesh>
      <mesh position={[0, 0.04 + height, depth / 2 - 0.03]}>
        <boxGeometry args={[width - 0.16, 0.008, 0.014]} />
        <MetalMaterial color={GENETICS_COLORS.brassPolished} roughness={0.26} />
      </mesh>
    </group>
  );
}

/**
 * Circular brushed-brass and borosilicate glass microscope specimen stage,
 * anchoring cellular and molecular structures over the seamless benchtop.
 */
export function SlideStage({
  position = [0, 0, 0],
  radius = 0.96,
}: {
  readonly position?: readonly [number, number, number];
  readonly radius?: number;
}) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.022, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius * 1.04, 0.044, 64]} />
        <meshPhysicalMaterial
          clearcoat={0.36}
          clearcoatRoughness={0.3}
          color={GENETICS_COLORS.slatePlinth}
          metalness={0.54}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[0, 0.046, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.97, 0.012, 12, 64]} />
        <MetalMaterial color={GENETICS_COLORS.brassPolished} roughness={0.26} />
      </mesh>
      <mesh position={[0, 0.052, 0]} receiveShadow>
        <cylinderGeometry args={[radius * 0.91, radius * 0.91, 0.012, 64]} />
        <GlassMaterial color={GENETICS_COLORS.frostedGlass} opacity={0.28} />
      </mesh>
      <mesh position={[0, 0.058, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.72, 0.004, 8, 64]} />
        <MetalMaterial color={GENETICS_COLORS.brassDark} roughness={0.34} />
      </mesh>
    </group>
  );
}

/**
 * Machined covalent, hydrogen, or structural bond rod oriented cleanly between
 * two 3D points.
 */
export function MolecularStick({
  color,
  emissive,
  emissiveIntensity = 0,
  end,
  metalness = 0.35,
  opacity = 1,
  radius = 0.016,
  roughness = 0.3,
  start,
}: {
  readonly color: string;
  readonly emissive?: string | undefined;
  readonly emissiveIntensity?: number;
  readonly end: readonly [number, number, number];
  readonly metalness?: number;
  readonly opacity?: number;
  readonly radius?: number;
  readonly roughness?: number;
  readonly start: readonly [number, number, number];
}) {
  const { length, mid, quat } = useMemo(() => {
    const a = new Vector3(start[0], start[1], start[2]);
    const b = new Vector3(end[0], end[1], end[2]);
    const diff = new Vector3().subVectors(b, a);
    const len = Math.max(0.001, diff.length());
    const center = new Vector3().addVectors(a, b).multiplyScalar(0.5);
    const orientation = new Quaternion().setFromUnitVectors(
      UP_AXIS,
      diff.clone().normalize()
    );
    return {
      length: len,
      mid: [center.x, center.y, center.z] as const,
      quat: orientation,
    };
  }, [end, start]);

  return (
    <mesh castShadow position={mid} quaternion={quat}>
      <cylinderGeometry args={[radius, radius, length, 14]} />
      <meshPhysicalMaterial
        clearcoat={0.45}
        clearcoatRoughness={0.25}
        color={color}
        emissive={emissive ?? color}
        emissiveIntensity={emissive === undefined ? 0 : emissiveIntensity}
        metalness={metalness}
        opacity={opacity}
        roughness={roughness}
        transparent={opacity < 1}
      />
    </mesh>
  );
}
