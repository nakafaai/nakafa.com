import type { MicelleStage } from "@repo/design-system/components/contents/chemistry/micelle/model";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, Quaternion, TubeGeometry, Vector3 } from "three";

const UP = new Vector3(0, 1, 0);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const FABRIC_SCUM_CLUMPS = [
  { id: "fscum-0", r: 0.0072, x: -0.095, y: 0.03, z: 0.038 },
  { id: "fscum-1", r: 0.0064, x: -0.048, y: 0.029, z: -0.042 },
  { id: "fscum-2", r: 0.0076, x: 0.062, y: 0.03, z: 0.032 },
  { id: "fscum-3", r: 0.006, x: 0.105, y: 0.029, z: -0.028 },
  { id: "fscum-4", r: 0.0068, x: -0.012, y: 0.03, z: 0.052 },
  { id: "fscum-5", r: 0.0058, x: 0.028, y: 0.029, z: -0.05 },
  { id: "fscum-6", r: 0.0065, x: -0.12, y: 0.029, z: -0.012 },
] as const;

/** Wavy zig-zag hydrophobic hydrocarbon tail aligned along +Y (0.022..0.056 m). */
function createZigZagTailGeometry() {
  const pts = Arr.makeBy(7, (index) => {
    const u = index / 6;
    const x = index % 2 === 0 ? -0.0032 : 0.0032;
    const z = index % 3 === 0 ? 0.0016 : -0.0016;
    return new Vector3(x, 0.022 + u * 0.034, z);
  });
  return new TubeGeometry(new CatmullRomCurve3(pts), 28, 0.0017, 8, false);
}

function dropletScaleFor(
  stage: MicelleStage
): readonly [number, number, number] {
  return Match.value(stage).pipe(
    Match.when("greaseOnFabric", () => [1.14, 0.82, 1.14] as const),
    Match.when("tailInsertion", () => [1.06, 0.92, 1.06] as const),
    Match.orElse(() => [1, 1, 1] as const)
  );
}

/** 3D glossy olive grease droplet surrounded spherically by amphiphilic soap anions. */
export function SurfactantMicelle({
  hasScum,
  soapCount,
  stage,
}: {
  readonly hasScum: boolean;
  readonly soapCount: number;
  readonly stage: MicelleStage;
}) {
  const tailGeo = useMemo(createZigZagTailGeometry, []);
  useEffect(() => () => tailGeo.dispose(), [tailGeo]);

  // Distribute surfactant anions evenly around a full 3D Fibonacci sphere
  const surfactants = useMemo(
    () =>
      Arr.makeBy(soapCount, (index) => {
        const y = 1 - ((index + 0.5) / Math.max(1, soapCount)) * 2;
        const ring = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = GOLDEN_ANGLE * index;
        const dir = new Vector3(
          Math.cos(theta) * ring,
          y,
          Math.sin(theta) * ring
        ).normalize();
        const quaternion = new Quaternion().setFromUnitVectors(UP, dir);
        return {
          id: `surf-${index}`,
          quaternion,
          scumBright: index % 2 === 0,
        };
      }),
    [soapCount]
  );

  const dropScale = dropletScaleFor(stage);
  const headColor = hasScum
    ? ORGANIC_COLORS.scumGray
    : ORGANIC_COLORS.hydrophilicBlue;

  return (
    <group>
      {/* Glossy olive lipid grease droplet */}
      <mesh castShadow scale={dropScale}>
        <sphereGeometry args={[0.031, 28, 22]} />
        <meshPhysicalMaterial
          clearcoat={0.92}
          clearcoatRoughness={0.1}
          color={ORGANIC_COLORS.greaseOlive}
          roughness={0.22}
        />
      </mesh>

      {/* 3D spherical shell of amphiphilic soap anions */}
      {Arr.map(surfactants, (unit) => (
        <group key={unit.id} quaternion={unit.quaternion}>
          {/* Wavy zig-zag hydrophobic amber tail embedded radially inward */}
          <mesh castShadow geometry={tailGeo}>
            <meshPhysicalMaterial
              clearcoat={0.35}
              color={ORGANIC_COLORS.hydrophobicAmber}
              roughness={0.34}
            />
          </mesh>
          {/* Glossy outward-pointing anionic carboxylate head */}
          <mesh castShadow position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.0082, 14, 12]} />
            <meshPhysicalMaterial
              clearcoat={hasScum ? 0.15 : 0.78}
              clearcoatRoughness={0.16}
              color={headColor}
              roughness={hasScum ? 0.72 : 0.18}
            />
          </mesh>
          {/* Chalky Ca2+/Mg2+ calcium-stearate soap scum encrusting head in hard water */}
          {hasScum ? (
            <group position={[0, 0.068, 0]}>
              <mesh rotation={[0.4, 0.8, 0.3]}>
                <dodecahedronGeometry args={[0.0068, 0]} />
                <meshStandardMaterial
                  color={
                    unit.scumBright
                      ? ORGANIC_COLORS.saltCrystal
                      : ORGANIC_COLORS.scumGray
                  }
                  roughness={0.9}
                />
              </mesh>
              <mesh position={[0.0055, -0.004, 0.004]} rotation={[1, 0.2, 0.6]}>
                <dodecahedronGeometry args={[0.0046, 0]} />
                <meshStandardMaterial
                  color={ORGANIC_COLORS.saltCrystal}
                  roughness={0.92}
                />
              </mesh>
            </group>
          ) : null}
        </group>
      ))}
    </group>
  );
}

/** Crystalline calcium-stearate soap scum clumps settled onto the fabric weave in hard water. */
export function FabricScumDeposits() {
  return (
    <group>
      {Arr.map(FABRIC_SCUM_CLUMPS, (clump, index) => (
        <mesh
          castShadow
          key={clump.id}
          position={[clump.x, clump.y, clump.z]}
          rotation={[index * 0.7, index * 1.1, index * 0.5]}
        >
          <dodecahedronGeometry args={[clump.r, 0]} />
          <meshStandardMaterial
            color={
              index % 2 === 0
                ? ORGANIC_COLORS.saltCrystal
                : ORGANIC_COLORS.scumGray
            }
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}
