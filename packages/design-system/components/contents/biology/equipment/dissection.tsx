import { RoundedBox } from "@react-three/drei";
import { PLACES } from "@repo/design-system/components/contents/biology/equipment/places";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape, Vector2 } from "three";

/** A No. 10 scalpel blade's outline, flat, its cutting belly curving to the point, 40 mm long. */
function createBlade() {
  const blade = new Shape();
  blade.moveTo(0, -0.003);
  blade.lineTo(0.022, -0.0036);
  blade.quadraticCurveTo(0.036, -0.0034, 0.04, 0.0028);
  blade.lineTo(0.026, 0.004);
  blade.lineTo(0, 0.003);
  blade.closePath();
  const geometry = new ExtrudeGeometry(blade, {
    bevelEnabled: false,
    depth: 0.0004,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.rotateY(-Math.PI / 2);
  return geometry;
}

/** The mounted needle's wooden handle, turned, 90 mm long, thicker at its end. */
const HANDLE = Arr.map(
  [
    [0.0008, 0],
    [0.0032, 0.004],
    [0.0038, 0.06],
    [0.0045, 0.085],
    [0.0028, 0.09],
    [0.0005, 0.0905],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/** The white tile the dissecting instruments lie on, 120 by 200 mm. */
export function DissectingTile() {
  const { base } = PLACES.scalpel;
  return (
    <RoundedBox
      args={[0.12, 0.006, 0.2]}
      position={[base[0], base[1] - 0.003, base[2]]}
      radius={0.002}
      receiveShadow
    >
      <meshPhysicalMaterial
        clearcoat={0.7}
        color={LABORATORY_COLORS.tile}
        roughness={0.3}
      />
    </RoundedBox>
  );
}

/** Blunt forceps, 120 mm of steel whose two arms spring apart at the tips. */
export function Forceps() {
  const { base } = PLACES.forceps;
  return (
    <group position={[base[0], base[1] + 0.0009, base[2] - 0.06]}>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[side * 0.0018, 0, 0.06]}
          rotation={[0, side * 0.028, 0]}
        >
          <boxGeometry args={[0.0032, 0.0016, 0.12]} />
          <MetalMaterial color={LABORATORY_COLORS.steel} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** A scalpel: a ribbed steel handle and a No. 10 blade, its cutting edge towards the learner. */
export function Scalpel() {
  const blade = useMemo(createBlade, []);
  useEffect(() => () => blade.dispose(), [blade]);
  const { base } = PLACES.scalpel;
  return (
    <group position={[base[0], base[1] + 0.0013, base[2] - 0.02]}>
      <mesh castShadow>
        <boxGeometry args={[0.008, 0.0024, 0.11]} />
        <MetalMaterial color={LABORATORY_COLORS.steel} roughness={0.38} />
      </mesh>
      {Arr.map(Arr.range(0, 5), (groove) => (
        <mesh key={groove} position={[0, 0.0013, -0.03 + groove * 0.006]}>
          <boxGeometry args={[0.0065, 0.0003, 0.0012]} />
          <MetalMaterial color={LABORATORY_COLORS.iron} roughness={0.5} />
        </mesh>
      ))}
      <mesh castShadow geometry={blade} position={[0, -0.0002, 0.055]}>
        <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.12} />
      </mesh>
    </group>
  );
}

/** A mounted needle: a steel needle set in a turned wooden handle, resting on the tile by its point and its handle. */
export function MountedNeedle() {
  const { base } = PLACES.mountedNeedle;
  return (
    <group
      position={[base[0], base[1] + 0.0017, base[2] - 0.02]}
      rotation={[Math.PI / 2 - 0.033, 0, 0]}
    >
      <mesh castShadow>
        <latheGeometry args={[HANDLE, 20]} />
        <meshStandardMaterial color={LABORATORY_COLORS.wood} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, -0.025, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.0006, 0.05, 8]} />
        <MetalMaterial color={LABORATORY_COLORS.steel} roughness={0.25} />
      </mesh>
    </group>
  );
}
