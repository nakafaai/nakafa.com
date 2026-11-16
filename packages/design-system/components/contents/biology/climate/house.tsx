import {
  houseSpot,
  VILLAGE,
} from "@repo/design-system/components/contents/biology/climate/sea";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  DoubleSide,
  type InstancedMesh,
  Matrix4,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Every kampung house stands on timber stilts that lift its floor 1.2 m above
 * the ground under it, so each one stands where the ground lies 1.2 m below
 * the floor height the model gives it, and the sea floods the house when it
 * climbs over that floor.
 */
export const STILT = 1.2;

/** The roof eave and ridge, in metres from the floor and the ridge line. */
const ROOF = { eave: 2.6, eaveHeight: 2.45, length: 6.4, ridge: 4.41 } as const;

/** The pitch of the main roof, about 37 degrees. */
const PITCH = Math.atan2(ROOF.ridge - ROOF.eaveHeight, ROOF.eave);

/** The length of one roof slope from the ridge to past the eave. */
const SLOPE = Math.hypot(ROOF.eave, ROOF.ridge - ROOF.eaveHeight) + 0.15;

/** The wood each house is built of, from dark chengal to fresh planks. */
const TONES = [
  MATERIAL.woodChengal,
  MATERIAL.woodMeranti,
  MATERIAL.woodWeathered,
  MATERIAL.woodPale,
  MATERIAL.woodMeranti,
  MATERIAL.woodWeathered,
  MATERIAL.woodChengal,
  MATERIAL.woodPale,
] as const;

/** Each house's roof: dried nipah attap, new zinc, or rusted zinc. */
const ROOFS = [
  "attap",
  "zinc",
  "rust",
  "attap",
  "zinc",
  "rust",
  "attap",
  "zinc",
] as const;

/** A box of `size` metres whose centre stands at `at`. */
function board(
  size: readonly [number, number, number],
  at: readonly [number, number, number]
) {
  return new BoxGeometry(...size).translate(...at).toNonIndexed();
}

/** Parts modelled along one roof slope, with the ridge at 0 and the eave along +z, laid on both slopes. */
function bothSlopes(parts: readonly BufferGeometry[]) {
  return Arr.flatMap(parts, (part) => {
    part.rotateX(PITCH).translate(0, ROOF.ridge, 0);
    return [part, part.clone().rotateY(Math.PI)];
  });
}

/** A gable end: the board wall that closes the roof's triangle over a side wall. */
function gable(x: number) {
  const shape = new Shape();
  shape.moveTo(-2, 2.5);
  shape.lineTo(2, 2.5);
  shape.lineTo(2, 2.88);
  shape.lineTo(0, ROOF.ridge - 0.08);
  shape.lineTo(-2, 2.88);
  shape.closePath();
  const face = new ShapeGeometry(shape);
  face.rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2);
  return face.translate(x, 0, 0).toNonIndexed();
}

/** The plank walls, the gables and the floors of the house and its veranda. */
function wallParts() {
  return mergeGeometries([
    board([5.6, 2.5, 0.08], [0, 1.25, 1.96]),
    board([5.6, 2.5, 0.08], [0, 1.25, -1.96]),
    board([0.08, 2.5, 3.84], [2.76, 1.25, 0]),
    board([0.08, 2.5, 3.84], [-2.76, 1.25, 0]),
    gable(2.801),
    gable(-2.801),
    board([5.6, 0.12, 4], [0, -0.06, 0]),
    board([4, 0.1, 1.5], [-0.8, -0.35, 2.75]),
  ]);
}

/** Where the windows stand: along the front and back walls, and in each side wall. */
const WINDOWS = {
  back: [-1.85, 0, 1.85],
  front: [0, 1.85],
} as const;

/**
 * The frame in the darker tone: stilts that run up as wall posts, floor
 * beams, the veranda's posts, rails and balusters, open shutters, and the
 * boards along the roof's eaves and gables.
 */
function trimParts() {
  const posts = Arr.flatMap([-2.78, -0.9, 0.9, 2.78], (x) => [
    board([0.14, 4.5, 0.14], [x, 0.25, 1.98]),
    board([0.14, 4.5, 0.14], [x, 0.25, -1.98]),
    board([0.14, 1.88, 0.14], [x, -1.06, 0]),
  ]);
  const beams = Arr.flatMap([-1.98, 0, 1.98], (z) => [
    board([5.7, 0.16, 0.14], [0, -0.2, z]),
  ]);
  const veranda = Arr.flatMap([-2.72, -0.75, 0.55, 1.12], (x) => [
    board([0.12, 3.85, 0.12], [x, -0.075, 3.42]),
  ]);
  const rails = [
    board([1.97, 0.06, 0.08], [-1.735, 0.42, 3.42]),
    board([0.57, 0.06, 0.08], [0.835, 0.42, 3.42]),
    board([0.08, 0.06, 1.42], [-2.72, 0.42, 2.71]),
    board([0.08, 0.06, 1.42], [1.12, 0.42, 2.71]),
    board([4, 0.14, 0.12], [-0.8, -0.47, 3.42]),
    board([4, 0.14, 0.12], [-0.8, 1.9, 3.42]),
    board([5.7, 0.1, 0.12], [0, 2.5, 1.98]),
    board([5.7, 0.1, 0.12], [0, 2.5, -1.98]),
  ];
  const balusters = Arr.flatMap(
    [
      ...Arr.map(
        Arr.range(0, 11),
        (step) => [-2.6 + step * 0.16, 3.42] as const
      ),
      ...Arr.map(
        Arr.range(0, 2),
        (step) => [0.69 + step * 0.16, 3.42] as const
      ),
      ...Arr.map(
        Arr.range(0, 7),
        (step) => [-2.72, 2.12 + step * 0.16] as const
      ),
      ...Arr.map(
        Arr.range(0, 7),
        (step) => [1.12, 2.12 + step * 0.16] as const
      ),
    ],
    ([x, z]) => [board([0.035, 0.69, 0.035], [x, 0.045, z])]
  );
  const shutters = Arr.flatMap([-0.6, 0.6], (offset) => [
    ...Arr.map(WINDOWS.front, (x) =>
      board([0.4, 1.2, 0.03], [x + offset, 1.3, 2.025])
    ),
    ...Arr.map(WINDOWS.back, (x) =>
      board([0.4, 1.2, 0.03], [x + offset, 1.3, -2.025])
    ),
    board([0.03, 1.2, 0.4], [2.825, 1.3, offset]),
    board([0.03, 1.2, 0.4], [-2.825, 1.3, offset]),
  ]);
  const edges = bothSlopes([
    board([0.04, 0.24, SLOPE], [3.22, -0.04, SLOPE / 2]),
    board([0.04, 0.24, SLOPE], [-3.22, -0.04, SLOPE / 2]),
    board([ROOF.length, 0.16, 0.03], [0, -0.06, SLOPE]),
  ]);
  return mergeGeometries([
    ...posts,
    ...beams,
    ...veranda,
    ...rails,
    ...balusters,
    ...shutters,
    ...edges,
  ]);
}

/** The dark rooms seen through the open door and windows, and the ventilation grilles under the eaves. */
function shadeParts() {
  return mergeGeometries([
    board([0.9, 2, 0.02], [-1.85, 1, 2.011]),
    ...Arr.map(WINDOWS.front, (x) => board([0.8, 1.2, 0.02], [x, 1.3, 2.011])),
    ...Arr.map(WINDOWS.back, (x) => board([0.8, 1.2, 0.02], [x, 1.3, -2.011])),
    board([0.02, 1.2, 0.8], [2.811, 1.3, 0]),
    board([0.02, 1.2, 0.8], [-2.811, 1.3, 0]),
    board([5.6, 0.33, 0.04], [0, 2.715, 1.96]),
    board([5.6, 0.33, 0.04], [0, 2.715, -1.96]),
  ]);
}

/** The concrete steps from the veranda down to the ground, set into it. */
function stepParts() {
  return mergeGeometries(
    Arr.map(Arr.range(0, 3), (step) => {
      const top = -0.48 - step * 0.18;
      const bottom = -STILT - 0.6;
      return board(
        [1, top - bottom, 0.26],
        [-0.1, (top + bottom) / 2, 3.63 + step * 0.26]
      );
    })
  );
}

/** The lean-to roof over the veranda, falling 0.3 m from the front wall. */
function verandaRoof(thickness: number) {
  const fall = Math.atan2(0.3, 1.78);
  return board([4.4, thickness, 1.77], [0, thickness / 2, 0.885])
    .rotateX(fall)
    .translate(-0.8, 2.2, 2.06);
}

/** A roof of flat zinc sheets on both slopes, a ridge cap and a veranda roof. */
function zincParts() {
  return mergeGeometries([
    ...bothSlopes([board([ROOF.length, 0.035, SLOPE], [0, 0.0175, SLOPE / 2])]),
    board([ROOF.length, 0.05, 0.4], [0, ROOF.ridge + 0.04, 0]),
    verandaRoof(0.035),
  ]);
}

/**
 * A roof of nipah attap: a thatch bed under five rows of shingles, each row
 * lifted at its butt where it laps the row below, a thick ridge and a
 * veranda roof.
 */
function attapParts() {
  const rows = Arr.map(Arr.range(0, 4), (row) =>
    board([ROOF.length, 0.1, 0.85], [0, 0, 0])
      .rotateX(-0.1)
      .translate(0, 0.12, SLOPE - 0.42 - row * 0.66)
  );
  return mergeGeometries([
    ...bothSlopes([
      board([ROOF.length, 0.07, SLOPE], [0, 0.035, SLOPE / 2]),
      ...rows,
    ]),
    board([ROOF.length, 0.24, 0.62], [0, ROOF.ridge + 0.1, 0]),
    verandaRoof(0.1),
  ]);
}

/** Where house `index` stands and how it turns: its veranda faces the lane between the two rows. */
function houseMatrix(index: number, floor: number) {
  const [x, , z] = houseSpot(index, floor - STILT);
  const turn =
    (index % 2 === 0 ? 0 : Math.PI) + (hashUnit(index, 9) - 0.5) * 0.1;
  return new Matrix4().compose(
    new Vector3(x, floor, z),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), turn),
    new Vector3(1, 1, 1)
  );
}

/** Copies of one geometry at `matrices`, each in its own colour, one draw call. */
function Copies({
  children,
  colors,
  geometry,
  matrices,
}: {
  readonly children: ReactNode;
  readonly colors: readonly Color[];
  readonly geometry: BufferGeometry;
  readonly matrices: readonly Matrix4[];
}) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    Arr.forEach(matrices, (matrix, index) => {
      target.setMatrixAt(index, matrix);
      target.setColorAt(index, colors[index] ?? new Color(MATERIAL.timber));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) {
      target.instanceColor.needsUpdate = true;
    }
    target.computeBoundingSphere();
  });
  return (
    <instancedMesh
      args={[geometry, undefined, matrices.length]}
      castShadow
      key={matrices.length}
      receiveShadow
      ref={mesh}
    >
      {children}
    </instancedMesh>
  );
}

/**
 * The kampung: a timber house on stilts at each of the model's floor
 * heights, with plank walls in its own wood, a pitched roof of attap or
 * zinc, a railed veranda and concrete steps. A house whose floor the sea
 * has reached shows walls darkened by the flood.
 */
export function Houses({ wet }: { readonly wet: readonly boolean[] }) {
  const parts = useMemo(
    () => ({
      attap: attapParts(),
      shade: shadeParts(),
      steps: stepParts(),
      trim: trimParts(),
      walls: wallParts(),
      zinc: zincParts(),
    }),
    []
  );
  useEffect(
    () => () => {
      Arr.forEach(
        [
          parts.attap,
          parts.shade,
          parts.steps,
          parts.trim,
          parts.walls,
          parts.zinc,
        ],
        (geometry) => geometry.dispose()
      );
    },
    [parts]
  );

  const houses = Arr.map(VILLAGE.floors, (floor, index) => {
    const tone = new Color(TONES[index % TONES.length] ?? MATERIAL.timber);
    const roof = ROOFS[index % ROOFS.length] ?? "zinc";
    return {
      matrix: houseMatrix(index, floor),
      roof,
      roofColor: new Color(
        roof === "rust" ? MATERIAL.zincRust : MATERIAL.roofZinc
      ),
      trim: tone.clone().multiplyScalar(0.62),
      wall: wet[index]
        ? tone.clone().lerp(new Color(MATERIAL.mud), 0.6).multiplyScalar(0.8)
        : tone,
    };
  });
  const thatched = Arr.filter(houses, (house) => house.roof === "attap");
  const zinc = Arr.filter(houses, (house) => house.roof !== "attap");
  const matrices = Arr.map(houses, (house) => house.matrix);
  const concrete = new Color(MATERIAL.concrete);
  const shade = new Color(MATERIAL.roomShade);

  return (
    <group>
      <Copies
        colors={Arr.map(houses, (house) => house.wall)}
        geometry={parts.walls}
        matrices={matrices}
      >
        <meshStandardMaterial roughness={0.86} side={DoubleSide} />
      </Copies>
      <Copies
        colors={Arr.map(houses, (house) => house.trim)}
        geometry={parts.trim}
        matrices={matrices}
      >
        <meshStandardMaterial roughness={0.8} />
      </Copies>
      <Copies
        colors={Arr.map(houses, () => shade)}
        geometry={parts.shade}
        matrices={matrices}
      >
        <meshStandardMaterial roughness={0.95} />
      </Copies>
      <Copies
        colors={Arr.map(houses, () => concrete)}
        geometry={parts.steps}
        matrices={matrices}
      >
        <meshStandardMaterial roughness={0.92} />
      </Copies>
      <Copies
        colors={Arr.map(zinc, (house) => house.roofColor)}
        geometry={parts.zinc}
        matrices={Arr.map(zinc, (house) => house.matrix)}
      >
        <meshStandardMaterial metalness={0.55} roughness={0.5} />
      </Copies>
      <Copies
        colors={Arr.map(thatched, () => new Color(MATERIAL.attap))}
        geometry={parts.attap}
        matrices={Arr.map(thatched, (house) => house.matrix)}
      >
        <meshStandardMaterial roughness={1} />
      </Copies>
    </group>
  );
}
