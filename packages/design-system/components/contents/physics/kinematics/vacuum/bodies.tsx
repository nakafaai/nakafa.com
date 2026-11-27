import { Brass } from "@repo/design-system/components/contents/physics/kinematics/vacuum/tube";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { DoubleSide, Shape, ShapeGeometry, Vector2 } from "three";

/** A coin: a struck brass disc with a raised rim, lying nearly flat as it falls. */
export function Coin() {
  return (
    <group rotation={[0.2, 0, 0.1]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.0125, 0.0125, 0.0018, 40]} />
        <Brass roughness={0.3} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.0122, 0.0011, 8, 40]} />
        <Brass />
      </mesh>
    </group>
  );
}

/** The outline of a feather's vane, wider on one side of the shaft than the other. */
function vaneGeometry() {
  const vane = new Shape();
  vane.moveTo(0, 0.046);
  vane.splineThru(
    Arr.map(
      [
        [0.008, 0.036],
        [0.0125, 0.016],
        [0.0125, -0.008],
        [0.008, -0.026],
        [0.002, -0.034],
        [-0.003, -0.03],
        [-0.008, -0.014],
        [-0.009, 0.01],
        [-0.006, 0.032],
        [0, 0.046],
      ] as const,
      ([x, y]) => new Vector2(x, y)
    )
  );
  const geometry = new ShapeGeometry(vane, 24);
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const across = position.getX(index);
    const along = position.getY(index);
    position.setZ(index, 60 * across * across + 1.6 * along * along);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A small white feather: a cupped vane of soft barbs on a tapering shaft. */
export function Feather() {
  const vane = useMemo(vaneGeometry, []);
  useEffect(() => () => vane.dispose(), [vane]);

  return (
    <group rotation={[0, 0, 0.35]}>
      <mesh castShadow geometry={vane}>
        <SurfaceMaterial
          bump={1}
          color={REAGENT_COLORS.foam}
          repeat={[1, 14]}
          roughness={0.95}
          side={DoubleSide}
          surface="cloth"
        />
      </mesh>
      <mesh position={[0, -0.008, 0.001]}>
        <cylinderGeometry args={[0.0003, 0.0009, 0.1, 6]} />
        <meshStandardMaterial color={BENCH_COLORS.cabinet} roughness={0.6} />
      </mesh>
    </group>
  );
}
