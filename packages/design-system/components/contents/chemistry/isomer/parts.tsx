import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import {
  BROMINE_ORIGIN,
  buildMolecularRig,
  createBromineTubeGeometry,
  createDropperGeometry,
  createPlinthGeometry,
  MODEL_ORIGIN,
} from "@repo/design-system/components/contents/chemistry/isomer/geometry";
import type { IsomerCompound } from "@repo/design-system/components/contents/chemistry/isomer/model";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";

/** Dark anodised rectangular specimen plinth with brass swivel base and nameplate. */
export function SpecimenPlinth() {
  const plinthGeo = useMemo(createPlinthGeometry, []);
  useEffect(() => () => plinthGeo.dispose(), [plinthGeo]);

  return (
    <group position={MODEL_ORIGIN}>
      <mesh castShadow geometry={plinthGeo} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.28}
          clearcoatRoughness={0.35}
          color={BENCH_COLORS.balanceBezel}
          metalness={0.45}
          roughness={0.38}
        />
      </mesh>
      {/* Front brushed brass plaque accent */}
      <mesh position={[0, 0.011, 0.0592]}>
        <boxGeometry args={[0.072, 0.0085, 0.0014]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
      </mesh>
      {/* Brushed brass central swivel turret */}
      <mesh castShadow position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.026, 0.03, 0.009, 32]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.031, 0]}>
        <cylinderGeometry args={[0.02, 0.022, 0.004, 28]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.24} />
      </mesh>
    </group>
  );
}

/** Genuine 3D ball-and-stick C4 hydrocarbon molecule mounted on twin brass support forks. */
export function MoleculeModel({
  compound,
}: {
  readonly compound: IsomerCompound;
}) {
  const rig = useMemo(() => buildMolecularRig(compound), [compound]);

  return (
    <group>
      {/* Twin brushed brass support forks cradling the molecular backbone */}
      {Arr.map(rig.supports, (fork) => (
        <mesh
          castShadow
          key={fork.id}
          position={fork.midpoint}
          quaternion={fork.quaternion}
        >
          <cylinderGeometry args={[0.0024, 0.0028, fork.length, 12]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
        </mesh>
      ))}

      {/* Carbon backbone spheres */}
      {Arr.map(rig.carbons, (carbon) => (
        <mesh
          castShadow
          key={carbon.id}
          position={[carbon.pos.x, carbon.pos.y, carbon.pos.z]}
        >
          <sphereGeometry args={[0.0185, 24, 18]} />
          <meshPhysicalMaterial
            clearcoat={0.62}
            clearcoatRoughness={0.16}
            color={ORGANIC_COLORS.carbonDark}
            roughness={0.26}
          />
        </mesh>
      ))}

      {/* C-C single bonds and twin parallel golden C=C double bonds */}
      {Arr.map(rig.ccBonds, (bond) =>
        bond.isDouble ? (
          <group key={bond.id}>
            {Arr.map([-1, 1] as const, (sign) => (
              <mesh
                castShadow
                key={`${bond.id}-${sign}`}
                position={[
                  bond.midpoint[0] + bond.perpOffset[0] * sign,
                  bond.midpoint[1] + bond.perpOffset[1] * sign,
                  bond.midpoint[2] + bond.perpOffset[2] * sign,
                ]}
                quaternion={bond.quaternion}
              >
                <cylinderGeometry args={[0.0038, 0.0038, bond.length, 14]} />
                <meshPhysicalMaterial
                  clearcoat={0.6}
                  color={ORGANIC_COLORS.doubleBondGold}
                  emissive={ORGANIC_COLORS.doubleBondGold}
                  emissiveIntensity={0.42}
                  metalness={0.5}
                  roughness={0.22}
                />
              </mesh>
            ))}
          </group>
        ) : (
          <mesh
            castShadow
            key={bond.id}
            position={bond.midpoint}
            quaternion={bond.quaternion}
          >
            <cylinderGeometry args={[0.0044, 0.0044, bond.length, 14]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
          </mesh>
        )
      )}

      {/* C-H bond cylinders and glossy white hydrogen spheres */}
      {Arr.map(rig.hydrogens, (hAtom) => (
        <group key={hAtom.id}>
          <mesh
            castShadow
            position={hAtom.bondMidpoint}
            quaternion={hAtom.bondQuaternion}
          >
            <cylinderGeometry args={[0.0026, 0.0026, hAtom.bondLength, 10]} />
            <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.3} />
          </mesh>
          <mesh castShadow position={hAtom.position}>
            <sphereGeometry args={[0.011, 16, 14]} />
            <meshPhysicalMaterial
              clearcoat={0.55}
              clearcoatRoughness={0.18}
              color={ORGANIC_COLORS.hydrogenWhite}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Oak mini test-tube block, borosilicate bromine-water tube, and hovering bromine dropper. */
export function BromineStation({
  unsaturated,
}: {
  readonly unsaturated: boolean;
}) {
  const { dropperGeo, tubeGeo } = useMemo(
    () => ({
      dropperGeo: createDropperGeometry(),
      tubeGeo: createBromineTubeGeometry(),
    }),
    []
  );

  useEffect(
    () => () => {
      dropperGeo.dispose();
      tubeGeo.dispose();
    },
    [dropperGeo, tubeGeo]
  );

  const liquidColor = unsaturated
    ? BENCH_COLORS.glass
    : ORGANIC_COLORS.bromineBrown;
  const liquidOpacity = unsaturated ? 0.28 : 0.88;

  return (
    <group position={BROMINE_ORIGIN}>
      {/* Compact oak mini test-tube block resting directly on LabBench y = 0 */}
      <mesh castShadow position={[0, 0.018, 0]} receiveShadow>
        <boxGeometry args={[0.068, 0.036, 0.068]} />
        <meshStandardMaterial color={INSTRUMENT_COLORS.oak} roughness={0.68} />
      </mesh>
      <mesh position={[0, 0.0362, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.0175, 0.0018, 8, 28]} />
        <meshStandardMaterial color={INSTRUMENT_COLORS.hair} roughness={0.78} />
      </mesh>

      {/* Slim chrome stand post and clamp arm for hovering dropper */}
      <mesh castShadow position={[0.024, 0.132, -0.024]}>
        <cylinderGeometry args={[0.0028, 0.0028, 0.228, 14]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
      <mesh
        castShadow
        position={[0.012, 0.226, -0.012]}
        rotation={[0, Math.PI / 4, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0022, 0.0022, 0.036, 12]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.226, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.007, 0.0022, 10, 22]} />
        <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.82} />
      </mesh>

      {/* Bromine water column inside test tube (rich reddish-brown for alkanes, clear for alkenes) */}
      {unsaturated ? (
        <>
          <mesh position={[0, 0.0265, 0]}>
            <sphereGeometry
              args={[0.0144, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]}
            />
            <LiquidMaterial color={liquidColor} opacity={liquidOpacity} />
          </mesh>
          <ColumnLiquid
            bottom={0.0265}
            color={liquidColor}
            level={0.106}
            opacity={liquidOpacity}
            radius={0.0144}
          />
        </>
      ) : (
        <>
          <mesh position={[0, 0.0265, 0]}>
            <sphereGeometry
              args={[0.0144, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]}
            />
            <meshPhysicalMaterial
              clearcoat={0.72}
              clearcoatRoughness={0.12}
              color={ORGANIC_COLORS.bromineBrown}
              emissive={ORGANIC_COLORS.bromineBrown}
              emissiveIntensity={0.28}
              opacity={0.95}
              roughness={0.16}
              transparent
            />
          </mesh>
          <mesh position={[0, (0.0265 + 0.106) / 2, 0]}>
            <cylinderGeometry args={[0.0144, 0.0144, 0.106 - 0.0265, 44]} />
            <meshPhysicalMaterial
              clearcoat={0.72}
              clearcoatRoughness={0.12}
              color={ORGANIC_COLORS.bromineBrown}
              emissive={ORGANIC_COLORS.bromineBrown}
              emissiveIntensity={0.28}
              opacity={0.95}
              roughness={0.16}
              transparent
            />
          </mesh>
        </>
      )}

      {/* Turned borosilicate test tube wall and rim */}
      <mesh castShadow geometry={tubeGeo} renderOrder={2}>
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.13} />
      </mesh>
      <mesh position={[0, 0.168, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.019, 0.001, 10, 40]} />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.62} />
      </mesh>

      {/* Hovering borosilicate bromine dropper */}
      <group position={[0, 0.194, 0]}>
        <ColumnLiquid
          bottom={0.024}
          color={ORGANIC_COLORS.bromineBrown}
          level={0.056}
          opacity={0.86}
          radius={0.0038}
        />
        <mesh castShadow geometry={dropperGeo} renderOrder={2}>
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.32} />
        </mesh>
        <mesh castShadow position={[0, 0.078, 0]}>
          <capsuleGeometry args={[0.0078, 0.014, 10, 20]} />
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.72} />
        </mesh>
      </group>
    </group>
  );
}
