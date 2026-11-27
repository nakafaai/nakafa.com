import { Sweep } from "@repo/design-system/components/three/form/part";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { Array as Arr } from "effect";

/** The radius of the eye at each end of a spring. */
const EYE = 0.02;

/** How far from each end of a spring its coils begin: the eye and the short shank under it. */
const SHANK = EYE * 2 + 0.025;

/**
 * A steel tension spring hanging from the origin, `length` long from eye to
 * eye. Its wire winds in a helix whose pitch is the length over its turns,
 * so a stretched spring opens every coil alike, and at each end the wire
 * runs in to the axis and closes into an eye a hook can take.
 *
 * @param coil - The radius of the coils, how many turns the wire makes, and the radius of the wire
 * @param length - The length of the spring from eye to eye
 */
export function Spring({
  coil,
  length,
}: {
  readonly coil: {
    readonly radius: number;
    readonly turns: number;
    readonly wire: number;
  };
  readonly length: number;
}) {
  return (
    <group>
      <mesh castShadow>
        <Sweep
          ends="round"
          path={{
            from: [0, -SHANK, 0],
            kind: "helix",
            lead: [[0, -EYE * 2, 0]],
            radius: coil.radius,
            tail: [[0, EYE * 2 - length, 0]],
            to: [0, SHANK - length, 0],
            turns: coil.turns,
          }}
          radius={coil.wire}
        />
        <Matter of="chrome" />
      </mesh>
      {Arr.map([-EYE, EYE - length], (y) => (
        <mesh castShadow key={y} position={[0, y, 0]}>
          <torusGeometry args={[EYE, coil.wire * 0.9, 10, 28]} />
          <Matter of="chrome" />
        </mesh>
      ))}
    </group>
  );
}
