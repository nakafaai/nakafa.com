import type { BoxSheet } from "@repo/design-system/components/contents/mathematics/optimize/model";
import { evaluateOptimizationBox } from "@repo/design-system/components/contents/mathematics/optimize/model";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { Solid } from "@repo/design-system/components/three/solid";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";
import { useMemo } from "react";

const CURVE_CUTS = Arr.makeBy(28, (i) => 0.1 + i * 0.1);

export function OptimizationBox3DScene({
  cutout,
  parts,
  sheet,
}: {
  readonly cutout: number;
  readonly parts: Readonly<
    Record<
      | "basePlate"
      | "cornerCutouts"
      | "optimalMarker"
      | "sideFlaps"
      | "volumeCurve",
      string
    >
  >;
  readonly sheet: BoxSheet;
}) {
  const box = evaluateOptimizationBox(sheet, cutout);
  const scale = 0.42;
  const hw = (box.baseLength * scale) / 2;
  const hd = (box.baseWidth * scale) / 2;
  const h = Math.max(0.12, cutout * scale);

  const boxFaces = useMemo(
    () => [
      [
        { x: -hw, y: 0, z: -hd },
        { x: hw, y: 0, z: -hd },
        { x: hw, y: 0, z: hd },
        { x: -hw, y: 0, z: hd },
      ],
      [
        { x: -hw, y: 0, z: hd },
        { x: hw, y: 0, z: hd },
        { x: hw, y: h, z: hd },
        { x: -hw, y: h, z: hd },
      ],
      [
        { x: -hw, y: 0, z: -hd },
        { x: hw, y: 0, z: -hd },
        { x: hw, y: h, z: -hd },
        { x: -hw, y: h, z: -hd },
      ],
      [
        { x: hw, y: 0, z: -hd },
        { x: hw, y: 0, z: hd },
        { x: hw, y: h, z: hd },
        { x: hw, y: h, z: -hd },
      ],
      [
        { x: -hw, y: 0, z: -hd },
        { x: -hw, y: 0, z: hd },
        { x: -hw, y: h, z: hd },
        { x: -hw, y: h, z: -hd },
      ],
    ],
    [hw, hd, h]
  );

  const cutoutCorner = useMemo(
    () => [
      { x: hw, y: 0.01, z: hd },
      { x: hw + h, y: 0.01, z: hd },
      { x: hw + h, y: 0.01, z: hd + h },
      { x: hw, y: 0.01, z: hd + h },
    ],
    [hw, hd, h]
  );

  const volumeCurvePts = useMemo(
    () =>
      Arr.map(CURVE_CUTS, (x) => ({
        x: -2.2 + x * 1.4,
        y: evaluateOptimizationBox(sheet, x).volume * 0.08,
        z: -2.0,
      })),
    [sheet]
  );

  const optVolume = evaluateOptimizationBox(sheet, box.optimalCut).volume;

  return (
    <group>
      <hemisphereLight
        args={[CALCULUS_COLORS.lightSky, CALCULUS_COLORS.lightGround, 1.35]}
      />
      {/* Folded open-top 3D box */}
      <Solid color={CALCULUS_COLORS.amberAccent} faces={boxFaces} />
      {/* Corner cutout footprint */}
      <Polygon
        color={CALCULUS_COLORS.roseAlert}
        opacity={0.35}
        vertices={cutoutCorner}
      />
      {/* Live volume curve V(x) in backdrop plane */}
      <LineEquation
        color={CALCULUS_COLORS.cobaltCurve}
        lineWidth={3}
        points={volumeCurvePts}
        showPoints={false}
        smooth
      />
      {/* Current cut marker on V(x) */}
      <mesh position={[-2.2 + cutout * 1.4, box.volume * 0.08, -2.0]}>
        <sphereGeometry args={[0.1, 14, 14]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.amberAccent}
          toneMapped={false}
        />
      </mesh>
      {/* Stationary optimal peak marker */}
      <mesh position={[-2.2 + box.optimalCut * 1.4, optVolume * 0.08, -2.0]}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshBasicMaterial
          color={CALCULUS_COLORS.emeraldSlope}
          toneMapped={false}
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.boxCraft}
        fontSize="compact"
        position={[-0.25, 0.22, 0.25]}
      >
        <span>{parts.basePlate}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.amberAccent}
        fontSize="compact"
        position={[hw + 0.32, h + 0.26, 0]}
      >
        <span>{parts.sideFlaps}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.roseAlert}
        fontSize="compact"
        position={[hw + h * 0.85, 0.16, hd + h + 0.22]}
      >
        <span>{parts.cornerCutouts}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.cobaltCurve}
        fontSize="compact"
        position={[-2.1, optVolume * 0.08 + 0.45, -2.0]}
      >
        <span>{parts.volumeCurve}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.emeraldSlope}
        fontSize="compact"
        position={[
          -2.2 + box.optimalCut * 1.4 + 0.25,
          optVolume * 0.08 + 0.32,
          -2.0,
        ]}
      >
        <span>{parts.optimalMarker}</span>
      </ThreeLabel>
    </group>
  );
}
