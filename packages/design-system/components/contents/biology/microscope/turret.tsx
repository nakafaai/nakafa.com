import { useFrame } from "@react-three/fiber";
import {
  Chrome,
  Grip,
  Turned,
} from "@repo/design-system/components/contents/biology/microscope/finish";
import {
  ENGRAVING_DROP,
  engraving,
  frontRadius,
  MOUNTING,
  NOSEPIECE,
  objectiveLength,
  objectiveProfile,
  ringBand,
} from "@repo/design-system/components/contents/biology/microscope/form";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { PrintSleeve } from "@repo/design-system/components/three/print/layer";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr, Option } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/**
 * The colour ring a maker paints on each objective, by its magnification:
 * red for ×4, yellow for ×10, light blue for ×40, white for ×100, as the
 * ISO 8578 code has it.
 */
function ringColor(power: number) {
  if (power <= 4) {
    return BIOLOGY_COLORS.objectiveRed;
  }
  if (power <= 10) {
    return BIOLOGY_COLORS.objectiveYellow;
  }
  return power <= 40
    ? BIOLOGY_COLORS.objectiveBlue
    : BIOLOGY_COLORS.objectiveWhite;
}

/**
 * One objective hanging from its shoulder: the chromed barrel turned from
 * its true profile, the knurled collar it is screwed in by, its engraved
 * power and aperture, the colour ring of its magnification, and its front
 * lens.
 */
function Objective({ power }: { readonly power: number }) {
  const rings = useMemo(() => objectiveProfile(power), [power]);
  const marks = useMemo(
    () => engraving(power, BIOLOGY_COLORS.microscopeBlack),
    [power]
  );
  const band = ringBand(power);
  const length = objectiveLength(power);
  const front = frontRadius(power);

  return (
    <group>
      <mesh castShadow>
        <Turned rings={rings} />
        <Chrome repeat={[2, 3]} />
        <group position={[0, -ENGRAVING_DROP, 0]}>
          <PrintSleeve radius={0.0116} sheet={marks} stock="engraving" />
        </group>
      </mesh>
      <mesh castShadow position={[0, -0.003_25, 0]}>
        <cylinderGeometry args={[0.012_75, 0.012_75, 0.0042, 72, 1, true]} />
        <Grip along={2} around={44} bright />
      </mesh>
      <mesh position={[0, band.y, 0]}>
        <cylinderGeometry
          args={[band.radius, band.radius, band.height, 72, 1, true]}
        />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={ringColor(power)}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, -length + 0.0002, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[front * 0.72, 40]} />
        <GlassMaterial color={BIOLOGY_COLORS.lensBlue} opacity={0.75} />
      </mesh>
    </group>
  );
}

/**
 * The revolving nosepiece with its objectives, each longer the more it
 * magnifies, so all share one focus. It eases round until the chosen
 * objective hangs over the specimen.
 *
 * @param objective - The power of the objective in use
 * @param objectives - The powers of the objectives on the nosepiece
 */
export function Turret({
  objective,
  objectives,
}: {
  readonly objective: number;
  readonly objectives: readonly [number, ...number[]];
}) {
  const turret = useRef<Group>(null);
  const chosen = Option.getOrElse(
    Arr.findFirstIndex(objectives, (each) => each === objective),
    () => 0
  );
  const spacing = (Math.PI * 2) / Math.max(objectives.length, 3);

  useFrame((state, delta) => {
    const group = turret.current;
    if (group === null) {
      return;
    }
    const gap = -chosen * spacing - group.rotation.y;
    if (Math.abs(gap) > 0.001) {
      group.rotation.y += gap * Math.min(1, delta * 6);
      state.invalidate();
    }
  });

  return (
    <group rotation={[MOUNTING.tilt, 0, 0]}>
      <mesh castShadow position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.013, 0.015, 0.022, 48]} />
        <Chrome />
      </mesh>
      <group ref={turret}>
        <mesh castShadow>
          <Turned rings={NOSEPIECE} />
          <Chrome repeat={[4, 2]} />
        </mesh>
        <mesh position={[0, -0.001, 0]}>
          <cylinderGeometry args={[0.0343, 0.0343, 0.0056, 96, 1, true]} />
          <Grip along={2} around={90} bright />
        </mesh>
        {Arr.map(objectives, (power, index) => (
          <group key={power} rotation={[0, index * spacing, 0]}>
            <group
              position={[0, -MOUNTING.underside, MOUNTING.mount]}
              rotation={[-MOUNTING.tilt, 0, 0]}
            >
              <Objective power={power} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}
