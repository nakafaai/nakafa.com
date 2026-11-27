import {
  BotanicalLeaf,
  FibrousRoots,
} from "@repo/design-system/components/contents/biology/botanical";
import type { RingMode } from "@repo/design-system/components/contents/biology/phloem/model";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, TubeGeometry, Vector3 } from "three";

const SIEVE_PORES = [
  [0, 0],
  [0.055, 0],
  [-0.055, 0],
  [0.028, 0.048],
  [-0.028, 0.048],
  [0.028, -0.048],
  [-0.028, -0.048],
] as const;

const PLASMODESMATA_Y = [0.76, 0.88, 1.0] as const;

/** Perforated sieve plate disc with dark pore openings and callose collar. */
function SievePlate({ y }: { readonly y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.145, 0.145, 0.032, 32]} />
        <meshPhysicalMaterial
          clearcoat={0.35}
          color={BOTANY_COLORS.sievePlate}
          roughness={0.42}
        />
      </mesh>
      {Arr.map(SIEVE_PORES, ([px, pz]) => (
        <mesh key={`${px}-${pz}`} position={[px, 0.017, pz]}>
          <cylinderGeometry args={[0.016, 0.016, 0.004, 12]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.sievePore}
            roughness={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Translucent vascular bundle cutaway: adjacent spiral xylem, perforated sieve tubes, nucleated companion cell, source leaf, and sink root. */
export function PhloemVascularBundle({
  bulgeScale,
  mode,
}: {
  readonly bulgeScale: number;
  readonly mode: RingMode;
}) {
  const xylemSpiral = useMemo(() => {
    const pts = Arr.makeBy(40, (i) => {
      const t = i / 39;
      const ang = t * Math.PI * 11;
      return new Vector3(
        -0.42 + Math.cos(ang) * 0.095,
        0.16 + t * 1.06,
        Math.sin(ang) * 0.095
      );
    });
    return new TubeGeometry(new CatmullRomCurve3(pts), 52, 0.012, 8, false);
  }, []);
  useEffect(() => () => xylemSpiral.dispose(), [xylemSpiral]);

  return (
    <group>
      {/* Back vascular cortex sheath cutaway housing (open cleanly toward +Z viewer) */}
      <mesh castShadow position={[-0.04, 0.68, -0.06]} receiveShadow>
        <cylinderGeometry
          args={[0.64, 0.64, 1.12, 36, 1, false, Math.PI * 0.55, Math.PI * 0.9]}
        />
        <meshStandardMaterial
          color={BOTANY_COLORS.barkBrown}
          roughness={0.86}
          side={DoubleSide}
        />
      </mesh>

      {/* Adjacent xylem vessel with translucent water column + spiral lignin wall */}
      <mesh position={[-0.42, 0.68, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 1.06, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.85}
          color={BOTANY_COLORS.waterBlue}
          opacity={0.56}
          roughness={0.14}
          transparent
        />
      </mesh>
      <mesh castShadow geometry={xylemSpiral}>
        <meshStandardMaterial
          color={BOTANY_COLORS.xylemCrimson}
          roughness={0.48}
        />
      </mesh>

      {/* Upper sieve-tube element (bulges with accumulated sap when bark is ringed) */}
      <mesh
        castShadow
        position={[0, 0.96, 0]}
        scale={[bulgeScale, 1, bulgeScale]}
      >
        <cylinderGeometry
          args={[
            0.138,
            0.142,
            0.48,
            32,
            1,
            true,
            Math.PI * 0.45,
            Math.PI * 1.1,
          ]}
        />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={BOTANY_COLORS.phloemGreen}
          opacity={0.78}
          roughness={0.34}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <SievePlate y={0.72} />

      {/* Lower sieve-tube element (intact) OR stripped ringed bark gap */}
      {mode === "intact" ? (
        <group>
          <mesh castShadow position={[0, 0.44, 0]}>
            <cylinderGeometry
              args={[
                0.138,
                0.138,
                0.52,
                32,
                1,
                true,
                Math.PI * 0.45,
                Math.PI * 1.1,
              ]}
            />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={BOTANY_COLORS.phloemGreen}
              opacity={0.78}
              roughness={0.34}
              side={DoubleSide}
              transparent
            />
          </mesh>
          <SievePlate y={0.22} />
        </group>
      ) : (
        <mesh castShadow position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.105, 0.115, 0.34, 24]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.barkFurrow}
            roughness={0.88}
          />
        </mesh>
      )}

      {/* Nucleated companion cell beside upper sieve tube */}
      <group position={[0.31, 0.9, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.115, 0.3, 12, 20]} />
          <meshPhysicalMaterial
            clearcoat={0.45}
            color={BOTANY_COLORS.companionTeal}
            opacity={0.62}
            roughness={0.32}
            transparent
          />
        </mesh>
        {/* Prominent companion cell nucleus */}
        <mesh position={[0, 0.03, 0.035]} scale={[0.85, 1.35, 0.85]}>
          <sphereGeometry args={[0.056, 18, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={FOLIAGE_COLORS.nucleus}
            roughness={0.38}
          />
        </mesh>
        {/* Plasmodesmata cytoplasmic bridges into sieve tube */}
        {Arr.map(PLASMODESMATA_Y, (py) => (
          <mesh
            key={py}
            position={[-0.145, py - 0.9, 0.02]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.012, 0.012, 0.1, 10]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.sucroseGold}
              roughness={0.35}
            />
          </mesh>
        ))}
      </group>

      {/* Source leaf feeding sucrose at the crown */}
      <BotanicalLeaf
        baseColor={BOTANY_COLORS.healthyLeafDeep}
        droop={0.18}
        length={0.58}
        position={[0.04, 1.24, 0]}
        rotation={[0.38, 0.25, 0.22]}
        veinColor={BOTANY_COLORS.healthyLeafVein}
        width={0.6}
      />

      {/* Sink storage tuber & fibrous roots at the base */}
      <group position={[0, 0.12, 0]}>
        <mesh castShadow rotation={[0.1, 0, 0.35]} scale={[1.45, 0.72, 0.92]}>
          <sphereGeometry args={[0.12, 20, 14]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.epidermisTan}
            roughness={0.78}
          />
        </mesh>
        <FibrousRoots
          color={BOTANY_COLORS.rootIvory}
          count={7}
          depth={0.14}
          position={[0, -0.02, 0]}
          seed={21}
          spread={0.28}
        />
      </group>
    </group>
  );
}
