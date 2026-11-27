import {
  leafBlade,
  useFoliageMaterial,
} from "@repo/design-system/components/contents/biology/flora";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, Color, TubeGeometry, Vector2, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const POT_PROFILE = [
  new Vector2(0.002, 0),
  new Vector2(0.115, 0),
  new Vector2(0.148, 0.165),
  new Vector2(0.162, 0.172),
  new Vector2(0.164, 0.205),
  new Vector2(0.144, 0.208),
  new Vector2(0.136, 0.176),
  new Vector2(0.112, 0.16),
];

/**
 * Sculpted Pisum sativum pea plant in a turned terracotta pot with dark soil,
 * arching vine stem, pinnate veined compound leaves, helical tendrils, and
 * papilionaceous purple (tall) or white (dwarf) blossoms.
 */
export function PeaPlantPot({
  height,
  position,
  seed = 1,
  tall,
}: {
  readonly height: number;
  readonly position: readonly [number, number, number];
  readonly seed?: number;
  readonly tall: boolean;
}) {
  const foliageMaterial = useFoliageMaterial();

  const { leavesGeo, stemGeo, tendrilGeo } = useMemo(() => {
    const leanX = (hashUnit(seed, 3) - 0.5) * 0.08;
    const leanZ = (hashUnit(seed, 7) - 0.5) * 0.06;
    const stemCurve = new CatmullRomCurve3([
      new Vector3(0, 0.17, 0),
      new Vector3(leanX * 0.4, 0.17 + height * 0.38, leanZ * 0.4),
      new Vector3(leanX * 0.85, 0.17 + height * 0.72, leanZ * 0.75),
      new Vector3(leanX, 0.17 + height, leanZ),
    ]);
    const stem = new TubeGeometry(
      stemCurve,
      18,
      tall ? 0.017 : 0.015,
      10,
      false
    );

    const topNode = stemCurve.getPoint(0.76);
    const tendrilPts = Arr.makeBy(18, (step) => {
      const u = step / 17;
      const a = u * Math.PI * 4.5;
      return new Vector3(
        topNode.x + 0.02 + u * 0.11 + Math.cos(a) * 0.018 * u,
        topNode.y + u * 0.04 + Math.sin(a) * 0.018 * u,
        topNode.z + Math.sin(a) * 0.022
      );
    });
    const tendril = new TubeGeometry(
      new CatmullRomCurve3(tendrilPts),
      20,
      0.0045,
      6,
      false
    );

    const baseCol = new Color(
      tall ? GENETICS_COLORS.tallLeaf : GENETICS_COLORS.dwarfLeaf
    );
    const tipCol = new Color(BIOLOGY_COLORS.leafUnder);
    const nodeCount = tall ? 4 : 2;
    const blades = Arr.flatMap(Arr.range(1, nodeCount), (n) => {
      const t = 0.24 + (n / (nodeCount + 0.5)) * 0.64;
      const origin = stemCurve.getPoint(t);
      const yaw = n * 1.45 + seed * 0.9;
      return Arr.map([-1, 1] as const, (side) =>
        leafBlade(
          origin,
          yaw + side * 0.95,
          0.26,
          tall ? 0.165 : 0.125,
          tall ? 0.095 : 0.075,
          0.32,
          5,
          baseCol,
          tipCol
        )
      );
    });
    return {
      leavesGeo: mergeGeometries(blades),
      stemGeo: stem,
      tendrilGeo: tendril,
    };
  }, [height, seed, tall]);

  useEffect(
    () => () => {
      stemGeo.dispose();
      tendrilGeo.dispose();
      leavesGeo.dispose();
    },
    [leavesGeo, stemGeo, tendrilGeo]
  );

  const blossomY = 0.17 + height + 0.01;
  const petalMain = tall
    ? GENETICS_COLORS.peaBlossomPurple
    : GENETICS_COLORS.peaBlossomWhite;
  const petalWing = tall
    ? GENETICS_COLORS.peaBlossomWing
    : GENETICS_COLORS.peaBlossomWhite;

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[POT_PROFILE, 32]} />
        <meshPhysicalMaterial
          clearcoat={0.08}
          color={BIOLOGY_COLORS.terracotta}
          roughness={0.78}
        />
      </mesh>
      <mesh position={[0, 0.172, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15, 0.005, 8, 32]} />
        <MetalMaterial color={GENETICS_COLORS.brassPolished} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.175, 0]} receiveShadow scale={[1, 0.28, 1]}>
        <sphereGeometry
          args={[0.132, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <meshStandardMaterial
          color={GENETICS_COLORS.pottingSoil}
          roughness={0.94}
        />
      </mesh>
      <mesh castShadow geometry={stemGeo}>
        <meshPhysicalMaterial
          color={GENETICS_COLORS.peaCalyx}
          roughness={0.56}
        />
      </mesh>
      <mesh geometry={tendrilGeo}>
        <meshStandardMaterial
          color={BIOLOGY_COLORS.leafUnder}
          roughness={0.58}
        />
      </mesh>
      <mesh castShadow geometry={leavesGeo} material={foliageMaterial} />

      <group position={[0, blossomY, 0.02]}>
        <mesh
          castShadow
          position={[0, 0.048, -0.015]}
          rotation={[-0.22, 0, 0]}
          scale={[1.2, 1, 0.35]}
        >
          <sphereGeometry args={[0.056, 16, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.28}
            color={petalMain}
            roughness={0.42}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={side}
            position={[side * 0.044, 0.014, 0.022]}
            rotation={[0.25, side * 0.45, side * 0.2]}
            scale={[0.7, 0.95, 0.35]}
          >
            <sphereGeometry args={[0.042, 14, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.22}
              color={petalWing}
              roughness={0.46}
            />
          </mesh>
        ))}
        <mesh position={[0, -0.015, 0.025]} scale={[0.6, 0.55, 0.8]}>
          <sphereGeometry args={[0.032, 12, 10]} />
          <meshStandardMaterial
            color={GENETICS_COLORS.peaCalyx}
            roughness={0.6}
          />
        </mesh>
      </group>
    </group>
  );
}
