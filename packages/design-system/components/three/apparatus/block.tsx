import { RoundedBox } from "@react-three/drei";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import { words } from "@repo/design-system/components/three/print/sheet";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** How far the edges of a block are planed round. */
const EDGE = 0.012;

/**
 * A planed wooden friction block standing on the origin: its edges eased,
 * a brass screw eye in each end at the height `eye` for a cord or the hook
 * of a newton meter, and its mass burnt into the face toward the reader.
 *
 * @param wood - The wood it is planed from
 * @param eye - How high above its base the screw eyes sit
 * @param size - How wide (along the pull), how tall and how deep it is
 * @param stamp - What is burnt into its face, such as its mass
 */
export function Block({
  wood,
  eye,
  size,
  stamp,
}: {
  readonly wood: "beech" | "maple" | "oak" | "walnut";
  readonly eye: number;
  readonly size: {
    readonly deep: number;
    readonly tall: number;
    readonly wide: number;
  };
  readonly stamp: string;
}) {
  const face = useMemo(
    () => ({
      height: size.tall * 0.5,
      marks: [
        words({
          at: [0, 0],
          ink: INSTRUMENT_COLORS.graphite,
          size: Math.min(size.tall * 0.26, size.wide * 0.2),
          text: stamp,
        }),
      ],
      width: size.wide * 0.9,
    }),
    [size.tall, size.wide, stamp]
  );

  return (
    <group>
      <RoundedBox
        args={[size.wide, size.tall, size.deep]}
        castShadow
        position={[0, size.tall / 2, 0]}
        radius={EDGE}
        receiveShadow
        smoothness={3}
      >
        <Matter of={wood} />
      </RoundedBox>
      <group position={[0, size.tall / 2, size.deep / 2 + 0.001]}>
        <PrintFace sheet={face} stock="ink" />
      </group>
      {Arr.map([-1, 1], (side) => (
        <group key={side} position={[(side * size.wide) / 2, eye, 0]}>
          <mesh
            castShadow
            position={[side * 0.012, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.006, 0.006, 0.024, 10]} />
            <Matter of="brass" />
          </mesh>
          <mesh castShadow position={[side * 0.042, 0, 0]}>
            <torusGeometry args={[0.02, 0.006, 10, 26]} />
            <Matter of="brass" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
