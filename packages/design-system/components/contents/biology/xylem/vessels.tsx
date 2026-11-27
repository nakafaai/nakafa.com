import {
  BotanicalLeaf,
  FibrousRoots,
} from "@repo/design-system/components/contents/biology/seedling";
import {
  latheProfile,
  liquidMeniscus,
} from "@repo/design-system/components/contents/chemistry/glassware";
import { LiquidMaterial } from "@repo/design-system/components/three/physical";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, TubeGeometry, Vector3 } from "three";

const ANNULAR_Y = [0.26, 0.42, 0.58, 0.74, 0.9, 1.06] as const;

const PITS = Arr.flatMap([-0.14, 0.14] as const, (x) =>
  Arr.map([0.34, 0.5, 0.66, 0.82, 0.98] as const, (y) => ({
    id: `pit-${x}-${y}`,
    x,
    y,
  }))
);

/** Cutaway woody stem exposing spiral, annular, and pitted lignified xylem vessels, rising water column with meniscus, root cortex, and leaf stomata. */
export function XylemVesselCutaway({
  columnHeight,
  reachesTop,
}: {
  readonly columnHeight: number;
  readonly reachesTop: boolean;
}) {
  const spiralGeo = useMemo(() => {
    const pts = Arr.makeBy(56, (i) => {
      const t = i / 55;
      const ang = t * Math.PI * 14;
      return new Vector3(
        Math.cos(ang) * 0.185,
        0.22 + t * 0.94,
        Math.sin(ang) * 0.185
      );
    });
    return new TubeGeometry(new CatmullRomCurve3(pts), 72, 0.013, 8, false);
  }, []);
  useEffect(() => () => spiralGeo.dispose(), [spiralGeo]);

  const waterProfile = useMemo(
    () =>
      latheProfile([
        [0.001, 0.18],
        [0.148, 0.18],
        ...liquidMeniscus(0.148, 0.18 + columnHeight),
        [0.001, 0.18 + columnHeight],
      ]),
    [columnHeight]
  );

  return (
    <group>
      {/* Root cortex soil block and absorbing root hairs at bottom */}
      <group position={[0, 0.09, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.48, 0.18, 32]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.epidermisTan}
            roughness={0.74}
          />
        </mesh>
        <FibrousRoots
          color={BOTANY_COLORS.rootIvory}
          count={10}
          depth={0.1}
          position={[0, 0.02, 0]}
          seed={71}
          spread={0.46}
        />
      </group>

      {/* Outer woody stem bark cutaway shell (back -Z half only, cleanly open toward viewer) */}
      <mesh castShadow position={[0, 0.68, -0.02]} receiveShadow>
        <cylinderGeometry
          args={[0.31, 0.34, 1.04, 36, 1, false, Math.PI * 0.55, Math.PI * 0.9]}
        />
        <meshStandardMaterial
          color={BOTANY_COLORS.barkBrown}
          roughness={0.86}
          side={DoubleSide}
        />
      </mesh>

      {/* Translucent hollow lignified xylem vessel wall */}
      <mesh position={[0, 0.68, 0]} renderOrder={2}>
        <cylinderGeometry
          args={[0.18, 0.18, 1.0, 36, 1, true, Math.PI * 0.45, Math.PI * 1.1]}
        />
        <meshPhysicalMaterial
          clearcoat={0.38}
          color={BOTANY_COLORS.ligninBrown}
          opacity={0.56}
          roughness={0.42}
          side={DoubleSide}
          transparent
        />
      </mesh>

      {/* Helical spiral lignin secondary wall thickening */}
      <mesh castShadow geometry={spiralGeo}>
        <meshStandardMaterial
          color={BOTANY_COLORS.ligninHighlight}
          roughness={0.48}
        />
      </mesh>

      {/* Annular reinforcement rings & bordered pits */}
      {Arr.map(ANNULAR_Y, (y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.19, 0.011, 8, 28]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.ligninBrown}
            roughness={0.5}
          />
        </mesh>
      ))}
      {Arr.map(PITS, (pit) => (
        <mesh
          key={pit.id}
          position={[pit.x, pit.y, -0.09]}
          rotation={[0, pit.x > 0 ? -0.6 : 0.6, 0]}
        >
          <torusGeometry args={[0.022, 0.006, 6, 16]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.barkFurrow}
            roughness={0.7}
          />
        </mesh>
      ))}

      {/* Continuous cohesive translucent water column with concave meniscus */}
      <mesh>
        <latheGeometry args={[waterProfile, 36]} />
        <LiquidMaterial color={BOTANY_COLORS.waterBlue} opacity={0.76} />
      </mesh>

      {/* Veined leaf mesophyll crown + open stomatal guard cells */}
      <group position={[0, 1.2, 0]}>
        <BotanicalLeaf
          baseColor={BOTANY_COLORS.healthyLeafDeep}
          droop={0.18}
          length={0.62}
          position={[-0.04, 0, 0]}
          rotation={[0.34, 0.12, 0.2]}
          veinColor={BOTANY_COLORS.healthyLeafVein}
          width={0.62}
        />
        <BotanicalLeaf
          baseColor={BOTANY_COLORS.healthyLeaf}
          droop={0.18}
          length={0.58}
          position={[0.04, 0.02, 0]}
          rotation={[0.34, Math.PI - 0.16, 0.22]}
          veinColor={BOTANY_COLORS.healthyLeafVein}
          width={0.58}
        />
        {/* Open kidney-shaped guard cells at leaf crown */}
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={`gc-${side}`}
            position={[side * 0.052, 0.06, 0.08]}
            rotation={[Math.PI / 2, 0, side * 0.22]}
          >
            <capsuleGeometry args={[0.026, 0.075, 8, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.45}
              color={FOLIAGE_COLORS.guardWallInner}
              roughness={0.36}
            />
          </mesh>
        ))}
        {/* Soft multi-layered translucent water-vapor transpiration wisps */}
        {reachesTop
          ? Arr.map(
              [
                { op: 0.26, r: 0.055, x: -0.02, y: 0.15 },
                { op: 0.22, r: 0.078, x: 0.03, y: 0.24 },
                { op: 0.16, r: 0.105, x: -0.01, y: 0.34 },
              ] as const,
              (puff) => (
                <mesh
                  key={puff.y}
                  position={[puff.x, puff.y, 0.08]}
                  scale={[1.1, 0.72, 0.9]}
                >
                  <sphereGeometry args={[puff.r, 16, 12]} />
                  <meshBasicMaterial
                    color={BOTANY_COLORS.vaporMist}
                    depthWrite={false}
                    opacity={puff.op}
                    transparent
                  />
                </mesh>
              )
            )
          : null}
      </group>
    </group>
  );
}
