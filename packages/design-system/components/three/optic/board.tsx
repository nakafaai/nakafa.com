import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { DoubleSide, Shape } from "three";

/** How thick the baseboard is, which is how high its felt stands above the bench. */
export const BOARD_TALL = 0.05;

/** How wide the oak lip round the felt is. */
const LIP = 0.07;

/** A rectangle with rounded corners, `wide` by `deep`, about the origin. */
function roundedOutline(wide: number, deep: number, round: number) {
  const outline = new Shape();
  const x = wide / 2;
  const y = deep / 2;
  outline.moveTo(-x + round, -y);
  outline.lineTo(x - round, -y);
  outline.quadraticCurveTo(x, -y, x, -y + round);
  outline.lineTo(x, y - round);
  outline.quadraticCurveTo(x, y, x - round, y);
  outline.lineTo(-x + round, y);
  outline.quadraticCurveTo(-x, y, -x, y - round);
  outline.lineTo(-x, -y + round);
  outline.quadraticCurveTo(-x, -y, -x + round, -y);
  return outline;
}

/**
 * The baseboard of a ray optics kit lying on the bench: an oak board with
 * rounded corners and a bevelled edge, `wide` along x and `deep` along z,
 * covered in matt black felt on which a beam that grazes it shows. Its felt
 * is `BOARD_TALL` above the bench, where the parts of the kit stand.
 *
 * @param wide - The length of the board along x
 * @param deep - The length of the board along z
 */
export function Board({
  deep,
  wide,
}: {
  readonly deep: number;
  readonly wide: number;
}) {
  const outline = useMemo(
    () => ({
      felt: roundedOutline(wide - LIP * 2, deep - LIP * 2, 0.03),
      wood: roundedOutline(wide - 0.02, deep - 0.02, 0.06),
    }),
    [deep, wide]
  );

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh castShadow position={[0, 0, 0.01]} receiveShadow>
        <extrudeGeometry
          args={[
            outline.wood,
            {
              bevelEnabled: true,
              bevelSegments: 3,
              bevelSize: 0.01,
              bevelThickness: 0.01,
              curveSegments: 10,
              depth: BOARD_TALL - 0.024,
            },
          ]}
        />
        <SurfaceMaterial
          coat={0.35}
          color={INSTRUMENT_COLORS.oak}
          repeat={[wide * 0.5, deep * 0.5]}
          roughness={0.55}
          surface="wood"
        />
      </mesh>
      <mesh position={[0, 0, BOARD_TALL - 0.004]} receiveShadow>
        <extrudeGeometry
          args={[
            outline.felt,
            { bevelEnabled: false, curveSegments: 8, depth: 0.004 },
          ]}
        />
        <SurfaceMaterial
          bump={1}
          color={INSTRUMENT_COLORS.graphite}
          repeat={[wide * 5, deep * 5]}
          roughness={1}
          surface="cloth"
        />
      </mesh>
      {Arr.map(
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ] as const,
        ([x, y]) => (
          <mesh
            castShadow
            key={`${x} ${y}`}
            position={[x * (wide / 2 - 0.12), y * (deep / 2 - 0.12), 0.006]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.045, 0.05, 0.012, 28]} />
            <SurfaceMaterial
              color={INSTRUMENT_COLORS.graphite}
              roughness={0.9}
              surface="rubber"
            />
          </mesh>
        )
      )}
    </group>
  );
}

/**
 * The arc of an angle, lying flat in the plane a ray travels in: from the
 * direction `from` round to the direction `to`, both in radians measured
 * from +x toward -z, as an angle on a page is measured from its right
 * toward its top. It is a mark, not light, so it does not glow.
 *
 * @param color - The colour of the mark
 * @param from - The direction the arc starts at, in radians
 * @param to - The direction the arc ends at, in radians
 * @param radius - How far from the vertex the arc is drawn
 */
export function Arc({
  color,
  from,
  radius,
  to,
}: {
  readonly color: string;
  readonly from: number;
  readonly radius: number;
  readonly to: number;
}) {
  return (
    <mesh renderOrder={9} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry
        args={[
          radius - 0.012,
          radius + 0.012,
          48,
          1,
          Math.min(from, to),
          Math.abs(to - from),
        ]}
      />
      <meshBasicMaterial
        color={color}
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}
