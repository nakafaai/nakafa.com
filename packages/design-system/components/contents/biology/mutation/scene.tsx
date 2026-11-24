import { useThree } from "@react-three/fiber";
import type { MutationKind } from "@repo/design-system/components/contents/biology/mutation/model";
import { evaluateChromosomeMutation } from "@repo/design-system/components/contents/biology/mutation/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr, Match } from "effect";

function MutationCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.35] : [0, 1.28, 2.7]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

function bandColor(code: "A" | "B" | "C" | "D"): string {
  return Match.value(code).pipe(
    Match.when("A", () => GENETICS_COLORS.bandA),
    Match.when("B", () => GENETICS_COLORS.bandB),
    Match.when("C", () => GENETICS_COLORS.bandC),
    Match.when("D", () => GENETICS_COLORS.bandD),
    Match.exhaustive
  );
}

const REFERENCE_BANDS = ["A", "B", "C", "D"] as const;

export function ChromosomeMutationScene({
  mutation,
  parts,
}: {
  readonly mutation: MutationKind;
  readonly parts: Readonly<
    Record<"brokenSegment" | "centromere" | "extraCopy" | "normalArm", string>
  >;
}) {
  const profile = evaluateChromosomeMutation(mutation);

  return (
    <group>
      <MutationCamera />
      {/* Normal reference chromosome (left) */}
      <group position={[-0.58, 0.62, 0]}>
        {Arr.map(REFERENCE_BANDS, (code, index) => (
          <mesh
            castShadow
            key={`ref-${code}`}
            position={[0, 0.36 - index * 0.24, 0]}
          >
            <cylinderGeometry args={[0.09, 0.09, 0.21, 16]} />
            <meshStandardMaterial color={bandColor(code)} roughness={0.42} />
          </mesh>
        ))}
        <mesh position={[0, 0.12, 0]}>
          <sphereGeometry args={[0.1, 14, 12]} />
          <meshStandardMaterial color={GENETICS_COLORS.centromereGold} />
        </mesh>
      </group>

      {/* Mutated chromosome (center/right) */}
      <group position={[0.22, 0.62, 0]}>
        {Arr.map(profile.bands, (band, index) => (
          <mesh castShadow key={band.id} position={[0, 0.42 - index * 0.21, 0]}>
            <cylinderGeometry
              args={[
                band.highlighted ? 0.108 : 0.09,
                band.highlighted ? 0.108 : 0.09,
                0.19,
                16,
              ]}
            />
            <meshStandardMaterial
              color={bandColor(band.code)}
              emissive={GENETICS_COLORS.brokenHighlight}
              emissiveIntensity={band.highlighted ? 0.28 : 0}
              roughness={0.4}
            />
          </mesh>
        ))}
        <mesh position={[0, 0.12, 0]}>
          <sphereGeometry args={[0.1, 14, 12]} />
          <meshStandardMaterial color={GENETICS_COLORS.centromereGold} />
        </mesh>
      </group>

      {/* Extra copy for nondisjunction (trisomy) or non-homologue for translocation */}
      {profile.copyCount === 3 || profile.hasNonHomologue ? (
        <group position={[0.72, 0.62, 0]}>
          {Arr.map(REFERENCE_BANDS, (code, index) => (
            <mesh
              castShadow
              key={`extra-${code}`}
              position={[0, 0.36 - index * 0.24, 0]}
            >
              <cylinderGeometry args={[0.085, 0.085, 0.2, 14]} />
              <meshStandardMaterial
                color={
                  profile.hasNonHomologue && code === "C"
                    ? GENETICS_COLORS.brokenHighlight
                    : GENETICS_COLORS.extraCopyPurple
                }
                roughness={0.45}
              />
            </mesh>
          ))}
        </group>
      ) : null}

      {/* Labels */}
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.64, 1.18, 0]}
      >
        <span>{parts.normalArm}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.98, 0.74, 0]}
      >
        <span>{parts.centromere}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0.24, 1.18, 0]}
      >
        <span>{parts.brokenSegment}</span>
      </ThreeLabel>
      {profile.copyCount === 3 || profile.hasNonHomologue ? (
        <ThreeLabel
          color={GENETICS_COLORS.labelInk}
          fontSize="compact"
          position={[0.88, 1.12, 0]}
        >
          <span>{parts.extraCopy}</span>
        </ThreeLabel>
      ) : null}
    </group>
  );
}
