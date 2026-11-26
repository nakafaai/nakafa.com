import type { RevolutionProfile } from "@repo/design-system/components/contents/mathematics/revolution/model";
import { evaluateSolidRevolution } from "@repo/design-system/components/contents/mathematics/revolution/model";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import { CALCULUS_COLORS } from "@repo/design-system/lib/material/calculus";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { DoubleSide, Vector2 } from "three";

const PROFILE_TS = Arr.makeBy(25, (i) => i / 24);

function profileRadius(profile: RevolutionProfile, t: number): number {
  if (profile === "paraboloid") {
    return 0.25 + Math.sqrt(t) * 1.15;
  }
  if (profile === "trumpetHorn") {
    return 1.35 / (1 + t * 1.35);
  }
  if (profile === "washerBowl") {
    return 0.72 + Math.sin(t * Math.PI * 0.65) * 0.65;
  }
  return 0.5 + t * 0.85;
}

export function SolidOfRevolutionScene({
  parts,
  profile,
  sweepAngle,
}: {
  readonly parts: Readonly<
    Record<
      | "crossSectionDisk"
      | "profileCurve"
      | "radiusArrow"
      | "revolvedShell"
      | "rotationAxis",
      string
    >
  >;
  readonly profile: RevolutionProfile;
  readonly sweepAngle: number;
}) {
  const metrics = evaluateSolidRevolution(profile, sweepAngle);
  const thetaLen = (Math.min(360, Math.max(15, sweepAngle)) * Math.PI) / 180;

  const lathePoints = useMemo(
    () =>
      Arr.map(
        PROFILE_TS,
        (t) => new Vector2(profileRadius(profile, t), -1.6 + t * 3.2)
      ),
    [profile]
  );

  const curvePoints = useMemo(
    () =>
      Arr.map(PROFILE_TS, (t) => ({
        x: -1.6 + t * 3.2,
        y: profileRadius(profile, t),
        z: 0,
      })),
    [profile]
  );

  const midRadius = profileRadius(profile, 0.5);

  return (
    <group>
      <hemisphereLight
        args={[CALCULUS_COLORS.lightSky, CALCULUS_COLORS.lightGround, 1.25]}
      />
      {/* Profile curve y = f(x) */}
      <LineEquation
        color={CALCULUS_COLORS.amberAccent}
        lineWidth={3.2}
        points={curvePoints}
        showPoints={false}
        smooth
      />
      {/* Smooth revolved lathe surface around x-axis */}
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <latheGeometry args={[lathePoints, 40, 0, thetaLen]} />
        <meshStandardMaterial
          color={CALCULUS_COLORS.cobaltCurve}
          opacity={0.44}
          roughness={0.28}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {/* Highlighted cross-section disk/washer slice at x = 0 */}
      <mesh position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry
          args={[metrics.innerRadius * 1.1, midRadius, 36, 1, 0, thetaLen]}
        />
        <meshBasicMaterial
          color={CALCULUS_COLORS.amberAccent}
          opacity={0.72}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      {/* Radius vector arrow R(x) */}
      <ArrowHelper
        color={CALCULUS_COLORS.roseAlert}
        from={[0, 0, 0]}
        label={parts.radiusArrow}
        labelSize="compact"
        lineWidth={3}
        to={[0, midRadius, 0]}
      />
      {/* Labels */}
      <ThreeLabel
        color={CALCULUS_COLORS.axisGray}
        fontSize="compact"
        position={[-2.1, -0.35, 0]}
      >
        <span>{parts.rotationAxis}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.amberAccent}
        fontSize="compact"
        position={[0.2, midRadius + 0.45, 0]}
      >
        <span>{parts.crossSectionDisk}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.amberAccent}
        fontSize="compact"
        position={[1.7, profileRadius(profile, 1) + 0.35, 0]}
      >
        <span>{parts.profileCurve}</span>
      </ThreeLabel>
      <ThreeLabel
        color={CALCULUS_COLORS.cobaltCurve}
        fontSize="compact"
        position={[-1.3, -1.2, 0.7]}
      >
        <span>{parts.revolvedShell}</span>
      </ThreeLabel>
    </group>
  );
}
