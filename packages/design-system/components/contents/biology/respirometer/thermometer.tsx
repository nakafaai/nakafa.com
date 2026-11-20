import { BEAKER } from "@repo/design-system/components/contents/biology/respirometer/beaker";
import { thermometerShare } from "@repo/design-system/components/contents/biology/respirometer/gas";
import type { Outline } from "@repo/design-system/components/contents/biology/respirometer/glass";
import {
  arc,
  ClearGlass,
  useLathe,
} from "@repo/design-system/components/contents/biology/respirometer/glass";
import { RESPIROMETER_COLORS } from "@repo/design-system/lib/material/respirometer";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";

/**
 * A −10 to 110 °C laboratory thermometer, in metres: 305 mm long with a
 * 76 mm immersion line (Scientific Laboratory Supplies THE1080), its stem
 * and bulb radii, and where its graduations are drawn, from just above the
 * immersion line to 20 mm below its top.
 */
const THERMOMETER = {
  bulb: 0.0024,
  immersion: 0.076,
  length: 0.305,
  scale: { from: 0.085, to: 0.285 },
  stem: 0.003,
} as const;

/** The thermometer's glass turned from the tip of its bulb: a slim bulb, a neck, the stem, and a rounded top. */
const THERMOMETER_OUTLINE: Outline = [
  ...arc(0, THERMOMETER.bulb, THERMOMETER.bulb, -Math.PI / 2, 0, 6),
  [THERMOMETER.bulb, 0.012],
  [THERMOMETER.stem * 0.9, 0.016],
  [THERMOMETER.stem, 0.02],
  ...arc(
    0,
    THERMOMETER.length - THERMOMETER.stem,
    THERMOMETER.stem,
    0,
    Math.PI / 2,
    6
  ),
];

/**
 * A thermometer standing on the tip of its bulb, its red spirit filled to
 * `share` of its graduations, with the white enamel stripe behind the
 * spirit facing −z, a graduation every 10 °C, and its immersion line.
 */
export function Thermometer({ share }: { readonly share: number }) {
  const glass = useLathe(THERMOMETER_OUTLINE, 24);
  const column =
    THERMOMETER.scale.from +
    share * (THERMOMETER.scale.to - THERMOMETER.scale.from);
  const marks = Arr.map(Arr.range(0, 12), (tens) => ({
    height:
      THERMOMETER.scale.from +
      (tens / 12) * (THERMOMETER.scale.to - THERMOMETER.scale.from),
    tens,
  }));
  return (
    <group>
      <mesh position={[0, THERMOMETER.bulb + 0.002, 0]}>
        <capsuleGeometry args={[THERMOMETER.bulb * 0.72, 0.006, 4, 12]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={RESPIROMETER_COLORS.spirit}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, (0.01 + column) / 2, 0]}>
        <cylinderGeometry args={[0.0005, 0.0005, column - 0.01, 8]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={RESPIROMETER_COLORS.spirit}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, (0.02 + THERMOMETER.length - 0.004) / 2, -0.0011]}>
        <boxGeometry args={[0.0024, THERMOMETER.length - 0.024, 0.0003]} />
        <meshStandardMaterial
          color={RESPIROMETER_COLORS.enamel}
          roughness={0.5}
        />
      </mesh>
      {Arr.map(marks, (mark) => (
        <mesh key={mark.tens} position={[0.0011, mark.height, -0.0009]}>
          <boxGeometry args={[0.0012, 0.000_25, 0.0002]} />
          <meshBasicMaterial color={RESPIROMETER_COLORS.ink} />
        </mesh>
      ))}
      <mesh
        position={[0, THERMOMETER.immersion, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[THERMOMETER.stem + 0.000_05, 0.0002, 4, 24]} />
        <meshBasicMaterial color={RESPIROMETER_COLORS.ink} />
      </mesh>
      <mesh geometry={glass} renderOrder={4}>
        <ClearGlass opacity={0.3} />
      </mesh>
    </group>
  );
}

/**
 * The bath's temperature, in °C: 30 °C, at which germinating seeds move the
 * drop about 18 mm in 10 minutes (igcsebiology.com.my, respiration rate
 * investigation).
 */
const BATH = 30;

/** Where the bath thermometer leans out against the rim, front left, and how far in from the wall its foot stands, in metres. */
const LEAN = {
  bearing: Math.PI * 0.86,
  foot: 0.036,
} as const;

/**
 * A thermometer standing on its bulb in the bath at the front left,
 * leaning out until its stem rests on the beaker's rim, its spirit at the
 * bath's temperature.
 */
export function BathThermometer() {
  const pose = useMemo(() => {
    const rim = BEAKER.radius - BEAKER.wall * 1.15 - THERMOMETER.stem;
    const tilt = Math.atan2(rim - LEAN.foot, BEAKER.height - BEAKER.wall);
    const out = new Vector3(Math.cos(LEAN.bearing), 0, Math.sin(LEAN.bearing));
    const axis = new Vector3(0, Math.cos(tilt), 0).addScaledVector(
      out,
      Math.sin(tilt)
    );
    return {
      position: out
        .clone()
        .multiplyScalar(LEAN.foot)
        .setY(BEAKER.wall)
        .toArray(),
      quaternion: new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        axis
      ),
    };
  }, []);
  return (
    <group position={pose.position} quaternion={pose.quaternion}>
      <Thermometer share={thermometerShare(BATH)} />
    </group>
  );
}
