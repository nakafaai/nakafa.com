import { RoundedBox } from "@react-three/drei";
import type { VectorConceptLabProps } from "@repo/design-system/components/contents/physics/vector/concept/lab";
import type { VectorConceptState } from "@repo/design-system/components/contents/physics/vector/concept/tension";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Rod } from "@repo/design-system/components/contents/physics/vector/solid/rod";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

/**
 * How far the model's points stand above the floor, in metres: the deck
 * girder lies on the floor, and the load hangs clear of the deck.
 */
export const LIFT = 0.7;

/** The deck girder the towers are bolted to: its length, depth and width. */
const DECK = { depth: 0.16, length: 5.9, width: 0.9 } as const;

/** The crate: a 0.42 m cube hung 0.1 m under the ring the cables meet at. */
const CRATE = { drop: 0.1, size: 0.42 } as const;

/** The universal column each tower is cut from: 200 mm deep and wide. */
const COLUMN = { flange: 0.024, size: 0.2, web: 0.014 } as const;

/** The four corners of a square of `half` round the middle. */
function corners(half: number) {
  return [
    [half, half],
    [half, -half],
    [-half, half],
    [-half, -half],
  ] as const;
}

/** A rolled steel I-section of the tower's height, standing on the deck. */
function columnGeometry(height: number) {
  const half = COLUMN.size / 2;
  const section = new Shape();
  section.moveTo(-half, -half);
  section.lineTo(half, -half);
  section.lineTo(half, -half + COLUMN.flange);
  section.lineTo(COLUMN.web / 2, -half + COLUMN.flange);
  section.lineTo(COLUMN.web / 2, half - COLUMN.flange);
  section.lineTo(half, half - COLUMN.flange);
  section.lineTo(half, half);
  section.lineTo(-half, half);
  section.lineTo(-half, half - COLUMN.flange);
  section.lineTo(-COLUMN.web / 2, half - COLUMN.flange);
  section.lineTo(-COLUMN.web / 2, -half + COLUMN.flange);
  section.lineTo(-half, -half + COLUMN.flange);
  section.closePath();
  const geometry = new ExtrudeGeometry(section, {
    bevelEnabled: false,
    depth: height,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Hot-dip galvanised steel, as bolts, shackles and wire rope are. */
function Galvanised() {
  return (
    <SurfaceMaterial
      bump={0.3}
      color={MACHINE_COLORS.galvanised}
      metalness={1}
      repeat={[2, 2]}
      roughness={0.42}
      surface="brushed"
    />
  );
}

/** Crane-yellow structural paint, lightly scuffed. */
function CranePaint({
  repeat,
}: {
  readonly repeat: readonly [number, number];
}) {
  return (
    <SurfaceMaterial
      color={MACHINE_COLORS.craneYellow}
      repeat={repeat}
      roughness={0.5}
      surface="paint"
    />
  );
}

/**
 * One tower at `x`: an I-section column on a bolted base plate, a knee brace
 * out to the deck, and on its cap the clevis whose pin holds the cable at
 * `anchor`.
 */
function Tower({ anchor, x }: { readonly anchor: number; readonly x: number }) {
  const height = anchor - 0.12 - DECK.depth;
  const column = useMemo(() => columnGeometry(height), [height]);
  useEffect(() => () => column.dispose(), [column]);
  const out = Math.sign(x);

  return (
    <group position={[x, DECK.depth, 0]}>
      <mesh castShadow position={[0, 0.012, 0]} receiveShadow>
        <boxGeometry args={[0.4, 0.024, 0.4]} />
        <Galvanised />
      </mesh>
      {Arr.map(corners(0.15), ([bx, bz]) => (
        <mesh castShadow key={`${bx}:${bz}`} position={[bx, 0.034, bz]}>
          <cylinderGeometry args={[0.02, 0.02, 0.022, 6]} />
          <Galvanised />
        </mesh>
      ))}
      <mesh castShadow geometry={column} receiveShadow>
        <CranePaint repeat={[1, 6]} />
      </mesh>
      <mesh castShadow position={[0, height + 0.012, 0]}>
        <boxGeometry args={[0.26, 0.024, 0.26]} />
        <CranePaint repeat={[1, 1]} />
      </mesh>
      {Arr.map([0.045, -0.045], (z) => (
        <mesh castShadow key={z} position={[0, height + 0.1, z]}>
          <boxGeometry args={[0.12, 0.16, 0.014]} />
          <CranePaint repeat={[1, 1]} />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0, height + 0.12, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.016, 0.016, 0.14, 16]} />
        <Galvanised />
      </mesh>
      <Rod
        color={MACHINE_COLORS.craneYellow}
        from={[out * 0.1, height * 0.55, 0]}
        radius={0.03}
        surface="paint"
        to={[out * 0.62, 0.02, 0]}
      />
    </group>
  );
}

/**
 * The load: a timber crate bound with steel straps, hung from the ring the
 * two cables meet at by its lifting eye.
 */
function Crate({ ring }: { readonly ring: CoordinateTuple }) {
  const half = CRATE.size / 2;
  return (
    <group position={ring}>
      <mesh castShadow rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.04, 0.011, 12, 32]} />
        <Galvanised />
      </mesh>
      <mesh castShadow position={[0, -CRATE.drop / 2 - 0.02, 0]}>
        <cylinderGeometry args={[0.012, 0.012, CRATE.drop - 0.04, 12]} />
        <Galvanised />
      </mesh>
      <mesh castShadow position={[0, -CRATE.drop + 0.006, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.012, 24]} />
        <Galvanised />
      </mesh>
      <group position={[0, -CRATE.drop - half, 0]}>
        <RoundedBox
          args={[CRATE.size, CRATE.size, CRATE.size]}
          castShadow
          radius={0.012}
          receiveShadow
          smoothness={3}
        >
          <SurfaceMaterial
            color={ENERGY_COLORS.crateWood}
            repeat={[2, 2]}
            surface="wood"
          />
        </RoundedBox>
        {Arr.map([-0.13, 0.13], (x) => (
          <mesh castShadow key={x} position={[x, 0, 0]}>
            <boxGeometry
              args={[0.035, CRATE.size + 0.008, CRATE.size + 0.008]}
            />
            <SurfaceMaterial
              color={CAR_COLORS.rimDark}
              metalness={1}
              repeat={[1, 3]}
              roughness={0.5}
              surface="brushed"
            />
          </mesh>
        ))}
        {Arr.map([half - 0.03, -half + 0.03], (y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry
              args={[CRATE.size + 0.006, 0.05, CRATE.size + 0.006]}
            />
            <SurfaceMaterial
              color={MACHINE_COLORS.ash}
              repeat={[3, 1]}
              surface="wood"
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * A crate hung by two wire ropes between the towers of a steel gantry, in
 * metres: the deck girder lies along x on the floor, and each rope's tension
 * is drawn from the ring as an arrow at one newton scale.
 */
export function VectorConceptScene({
  labels,
  vectorState,
}: {
  readonly labels: Pick<
    VectorConceptLabProps["labels"],
    "leftCable" | "rightCable"
  >;
  readonly vectorState: VectorConceptState;
}) {
  const lifted = ([x, y, z]: CoordinateTuple) =>
    [x, y + LIFT, z] satisfies CoordinateTuple;
  const ring = lifted(vectorState.loadPoint);
  const cables = [
    { ...vectorState.left, color: PLOT_COLORS.teal, name: labels.leftCable },
    {
      ...vectorState.right,
      color: PLOT_COLORS.violet,
      name: labels.rightCable,
    },
  ] as const;

  return (
    <group>
      <RoundedBox
        args={[DECK.length, DECK.depth, DECK.width]}
        castShadow
        position={[0, DECK.depth / 2, 0]}
        radius={0.012}
        receiveShadow
        smoothness={3}
      >
        <SurfaceMaterial
          color={MACHINE_COLORS.standBlue}
          repeat={[8, 2]}
          roughness={0.55}
          surface="paint"
        />
      </RoundedBox>
      <Crate ring={ring} />
      {Arr.map(cables, (cable) => {
        const anchor = lifted(cable.anchor);
        const tip = lifted(cable.arrowEnd);
        const side = Math.sign(anchor[0]);
        return (
          <group key={cable.color}>
            <Tower anchor={anchor[1]} x={anchor[0]} />
            <Rod
              color={MACHINE_COLORS.galvanised}
              from={ring}
              metalness={1}
              radius={0.011}
              surface="brushed"
              to={anchor}
            />
            <FixedArrow
              color={cable.color}
              from={ring}
              head={0.17}
              thickness={0.034}
              vector={[tip[0] - ring[0], tip[1] - ring[1], tip[2] - ring[2]]}
            />
            <ThreeLabel
              anchorX={side < 0 ? "left" : "right"}
              anchorY="bottom"
              color={cable.color}
              fontSize="reading"
              position={[anchor[0] + side * 0.25, anchor[1] + 0.16, 0]}
            >
              <span className="block">{cable.name}</span>
              <span className="block">
                <InlineMath
                  math={`${Math.round(cable.tension)}\\,\\mathrm{N}`}
                />
              </span>
            </ThreeLabel>
          </group>
        );
      })}
    </group>
  );
}
