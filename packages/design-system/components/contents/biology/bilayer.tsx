import { MolecularStick } from "@repo/design-system/components/contents/biology/workbench";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { ATOM_COLORS } from "@repo/design-system/lib/material/atom";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

/**
 * Builds curved fatty-acid hydrocarbon tail geometries: one gently undulating
 * saturated chain and one cis-double-bond kinked unsaturated chain.
 */
function useTailGeometries() {
  const geos = useMemo(() => {
    const satCurve = new CatmullRomCurve3([
      new Vector3(0, 0, 0),
      new Vector3(-0.008, -0.055, 0.006),
      new Vector3(0.006, -0.115, -0.005),
      new Vector3(-0.004, -0.175, 0.004),
    ]);
    const kinkCurve = new CatmullRomCurve3([
      new Vector3(0, 0, 0),
      new Vector3(0.006, -0.05, -0.004),
      new Vector3(0.022, -0.095, 0.008),
      new Vector3(0.044, -0.145, 0.012),
      new Vector3(0.052, -0.175, 0.005),
    ]);
    return {
      kinked: new TubeGeometry(kinkCurve, 14, 0.012, 7, false),
      saturated: new TubeGeometry(satCurve, 14, 0.012, 7, false),
    };
  }, []);

  useEffect(
    () => () => {
      geos.saturated.dispose();
      geos.kinked.dispose();
    },
    [geos]
  );

  return geos;
}

/**
 * Realistic multi-row 3D amphipathic phospholipid bilayer cutaway with glossy
 * hydrophilic phosphate heads, glycerol ester collars, paired saturated and
 * cis-kinked unsaturated hydrophobic fatty-acid tails, and configurable
 * protein cutouts so transmembrane channels embed seamlessly.
 */
export function PhospholipidBilayer({
  cols = 11,
  cutouts = [],
  opacity = 1,
  rows = 3,
  spacingX = 0.21,
  spacingZ = 0.2,
  yCenter = 0.56,
}: {
  readonly cols?: number;
  readonly cutouts?: readonly {
    readonly radius: number;
    readonly x: number;
    readonly z?: number;
  }[];
  readonly opacity?: number;
  readonly rows?: number;
  readonly spacingX?: number;
  readonly spacingZ?: number;
  readonly yCenter?: number;
}) {
  const { kinked, saturated } = useTailGeometries();

  const sites = useMemo(() => {
    const startX = -((cols - 1) * spacingX) / 2;
    const startZ = -((rows - 1) * spacingZ) / 2;
    const allSites = Arr.flatMap(Arr.range(0, rows - 1), (r) =>
      Arr.map(Arr.range(0, cols - 1), (c) => {
        const jitterX = (hashUnit(r * 19 + c, 3) - 0.5) * 0.024;
        const jitterZ = (hashUnit(r * 19 + c, 7) - 0.5) * 0.022;
        return {
          id: `pl-${r}-${c}`,
          x: startX + c * spacingX + jitterX,
          yaw: hashUnit(r * 31 + c, 11) * Math.PI * 2,
          z: startZ + r * spacingZ + jitterZ,
        };
      })
    );
    return Arr.filter(
      allSites,
      (site) =>
        !Arr.some(cutouts, (hole) => {
          const dx = site.x - hole.x;
          const dz = site.z - (hole.z ?? 0);
          return Math.hypot(dx, dz) < hole.radius;
        })
    );
  }, [cols, cutouts, rows, spacingX, spacingZ]);

  const headTransparent = opacity < 0.99;

  return (
    <group position={[0, yCenter, 0]}>
      {Arr.map(sites, (site) => (
        <group
          key={site.id}
          position={[site.x, 0, site.z]}
          rotation={[0, site.yaw, 0]}
        >
          {/* Upper (extracellular) phospholipid leaflet */}
          <group position={[0, 0.21, 0]}>
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[0.062, 18, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.78}
                clearcoatRoughness={0.18}
                color={HOMEOSTASIS_COLORS.phosphatePearl}
                opacity={opacity}
                roughness={0.28}
                transparent={headTransparent}
              />
            </mesh>
            <mesh position={[0, -0.056, 0]}>
              <cylinderGeometry args={[0.028, 0.034, 0.028, 12]} />
              <meshPhysicalMaterial
                clearcoat={0.4}
                color={HOMEOSTASIS_COLORS.phosphateCollar}
                opacity={opacity}
                roughness={0.42}
                transparent={headTransparent}
              />
            </mesh>
            <mesh geometry={saturated} position={[-0.018, -0.064, 0]}>
              <meshPhysicalMaterial
                color={HOMEOSTASIS_COLORS.tailSaturated}
                opacity={opacity}
                roughness={0.52}
                transparent={headTransparent}
              />
            </mesh>
            <mesh geometry={kinked} position={[0.018, -0.064, 0]}>
              <meshPhysicalMaterial
                color={HOMEOSTASIS_COLORS.tailUnsaturated}
                opacity={opacity}
                roughness={0.5}
                transparent={headTransparent}
              />
            </mesh>
          </group>

          {/* Lower (intracellular) phospholipid leaflet */}
          <group position={[0, -0.21, 0]} rotation={[Math.PI, 0, 0]}>
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[0.062, 18, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.78}
                clearcoatRoughness={0.18}
                color={HOMEOSTASIS_COLORS.phosphatePearl}
                opacity={opacity}
                roughness={0.28}
                transparent={headTransparent}
              />
            </mesh>
            <mesh position={[0, -0.056, 0]}>
              <cylinderGeometry args={[0.028, 0.034, 0.028, 12]} />
              <meshPhysicalMaterial
                clearcoat={0.4}
                color={HOMEOSTASIS_COLORS.phosphateCollar}
                opacity={opacity}
                roughness={0.42}
                transparent={headTransparent}
              />
            </mesh>
            <mesh geometry={saturated} position={[-0.018, -0.064, 0]}>
              <meshPhysicalMaterial
                color={HOMEOSTASIS_COLORS.tailSaturated}
                opacity={opacity}
                roughness={0.52}
                transparent={headTransparent}
              />
            </mesh>
            <mesh geometry={kinked} position={[0.018, -0.064, 0]}>
              <meshPhysicalMaterial
                color={HOMEOSTASIS_COLORS.tailUnsaturated}
                opacity={opacity}
                roughness={0.5}
                transparent={headTransparent}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/**
 * Fused 4-ring planar steroid cholesterol molecule (3 cyclohexane + 1
 * cyclopentane rings, polar hydroxyl group, and short hydrocarbon tail)
 * nestled between hydrophobic fatty-acid tails.
 */
export function CholesterolMolecule({
  opacity = 1,
  position,
  rotation = [0, 0, 0],
}: {
  readonly opacity?: number;
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
}) {
  const transparent = opacity < 0.99;
  const rings = [
    { pos: [0, 0.09, 0] as const, r: 0.036, sides: 6 },
    { pos: [0.026, 0.036, 0] as const, r: 0.036, sides: 6 },
    { pos: [-0.008, -0.018, 0] as const, r: 0.036, sides: 6 },
    { pos: [0.024, -0.068, 0] as const, r: 0.03, sides: 5 },
  ] as const;

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow position={[-0.022, 0.132, 0]}>
        <sphereGeometry args={[0.024, 14, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.75}
          color={HOMEOSTASIS_COLORS.cholesterolHydroxyl}
          opacity={opacity}
          roughness={0.24}
          transparent={transparent}
        />
      </mesh>
      {Arr.map(rings, (ring) => (
        <mesh
          castShadow
          key={`ring-${ring.pos[0]}-${ring.pos[1]}`}
          position={ring.pos}
        >
          <torusGeometry args={[ring.r, 0.01, 10, ring.sides]} />
          <meshPhysicalMaterial
            clearcoat={0.65}
            clearcoatRoughness={0.22}
            color={HOMEOSTASIS_COLORS.cholesterolRing}
            emissive={HOMEOSTASIS_COLORS.cholesterolRing}
            emissiveIntensity={opacity > 0.9 ? 0.14 : 0}
            opacity={opacity}
            roughness={0.28}
            transparent={transparent}
          />
        </mesh>
      ))}
      <MolecularStick
        color={HOMEOSTASIS_COLORS.cholesterolRing}
        end={[0.012, -0.145, 0.008]}
        opacity={opacity}
        radius={0.009}
        start={[0.022, -0.095, 0]}
      />
    </group>
  );
}

/**
 * Subtle bent triatomic H2O water molecule clusters floating in extracellular
 * and intracellular aqueous space around the membrane.
 */
export function WaterMolecules({
  positions,
}: {
  readonly positions: readonly (readonly [number, number, number])[];
}) {
  return (
    <group>
      {Arr.map(positions, ([x, y, z], idx) => (
        <group
          key={`w-${x}-${y}-${z}`}
          position={[x, y, z]}
          rotation={[idx * 0.7, idx * 1.1, idx * 0.4]}
        >
          <mesh>
            <sphereGeometry args={[0.022, 12, 10]} />
            <meshPhysicalMaterial
              clearcoat={0.85}
              color={ATOM_COLORS.cpkOxygen}
              opacity={0.78}
              roughness={0.18}
              transparent
            />
          </mesh>
          <mesh position={[-0.02, -0.015, 0]}>
            <sphereGeometry args={[0.014, 10, 8]} />
            <meshPhysicalMaterial
              clearcoat={0.7}
              color={ATOM_COLORS.cpkHydrogen}
              opacity={0.82}
              roughness={0.22}
              transparent
            />
          </mesh>
          <mesh position={[0.02, -0.015, 0]}>
            <sphereGeometry args={[0.014, 10, 8]} />
            <meshPhysicalMaterial
              clearcoat={0.7}
              color={ATOM_COLORS.cpkHydrogen}
              opacity={0.82}
              roughness={0.22}
              transparent
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
