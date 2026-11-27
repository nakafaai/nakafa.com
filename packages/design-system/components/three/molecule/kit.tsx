import {
  atomFacets,
  facetsOf,
  seamProfile,
} from "@repo/design-system/components/three/molecule/ball";
import { ELEMENTS } from "@repo/design-system/components/three/molecule/element";
import type {
  Molecule,
  Shape,
  Style,
} from "@repo/design-system/components/three/molecule/shape";
import {
  shapeOf,
  TUBE,
} from "@repo/design-system/components/three/molecule/shape";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import {
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { InstancedMesh } from "three";
import {
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** The axis a rod's cylinder is built along. */
const UP = new Vector3(0, 1, 0);

/** Each atom's mould seam is turned by this many radians more than the one before, so no two line up. */
const SEAM_TURN = 2.4;

/**
 * A molecule as a physical model: every atom a glossy moulded sphere with its
 * mould seam and fine relief, in its element's CPK colour, every bond a rod
 * and every polymer backbone a tube, drawn in the `style` structural biology
 * would choose. Atoms and rods are instanced, so a stretch of DNA with
 * hundreds of atoms costs three draw calls, and their detail follows the
 * stage's tier. A caller scales the model, whose atoms are placed in
 * angstrom, and may tint whole parts: `tints` gives the colour of each part
 * by its number, and a part without one keeps its elements' colours. A
 * ribbon's tubes take the `spine` colour, phosphorus orange unless given,
 * and `spines` may give each backbone its own, in the order of its traces.
 */
export function MoleculeModel({
  molecule,
  spine = ELEMENTS.P.color,
  spines = [],
  style,
  tints = [],
}: {
  readonly molecule: Molecule;
  readonly spine?: string;
  readonly spines?: readonly string[];
  readonly style: Style;
  readonly tints?: readonly (string | undefined)[];
}) {
  const shape = useMemo(() => shapeOf(molecule, style), [molecule, style]);
  return (
    <group>
      <Tints value={tints}>
        <Balls balls={shape.balls} />
        <Rods rods={shape.rods} />
      </Tints>
      {Arr.map(shape.tubes, (tube, index) => (
        <Tube
          color={spines[index] ?? spine}
          key={Arr.join(Arr.map(Arr.take(tube, 2), String), ":")}
          points={tube}
        />
      ))}
    </group>
  );
}

/** The colour a model's caller gives each part, by the part's number; none keeps the elements' colours. */
const Tints = createContext<readonly (string | undefined)[]>([]);

/** The colour of one drawn piece: its part's tint, or its element's CPK colour. */
function colorOf(
  piece: Readonly<{ element: keyof typeof ELEMENTS; part: number }>,
  tints: readonly (string | undefined)[]
) {
  return tints[piece.part] ?? ELEMENTS[piece.element].color;
}

/** Every atom as one instanced, moulded sphere. */
function Balls({ balls }: { readonly balls: Shape["balls"] }) {
  const tints = use(Tints);
  const { tier } = useStage();
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const facets = atomFacets(tier, balls.length);
    return new LatheGeometry(
      Arr.map(
        seamProfile(facets.rings),
        ([radius, height]) => new Vector2(radius, height)
      ),
      facets.sides
    );
  }, [balls.length, tier]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const axis = new Vector3();
    const place = new Vector3();
    const size = new Vector3();
    const color = new Color();
    Arr.forEach(balls, (ball, index) => {
      axis.set(Math.sin(index * 1.7), Math.cos(index * 2.9), Math.sin(index));
      turn.setFromAxisAngle(axis.normalize(), index * SEAM_TURN);
      matrix.compose(
        place.set(ball.at[0], ball.at[1], ball.at[2]),
        turn,
        size.setScalar(ball.radius)
      );
      target.setMatrixAt(index, matrix);
      target.setColorAt(index, color.set(colorOf(ball, tints)));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor !== null) {
      target.instanceColor.needsUpdate = true;
    }
    target.computeBoundingSphere();
  }, [balls, tints]);

  if (balls.length === 0) {
    return null;
  }
  return (
    <instancedMesh
      args={[geometry, undefined, balls.length]}
      castShadow
      key={balls.length}
      receiveShadow
      ref={mesh}
    >
      <SurfaceMaterial
        bump={0.35}
        coat={0.85}
        color={getColor("WHITE")}
        repeat={[3, 2]}
        roughness={0.42}
        surface="plastic"
      />
    </instancedMesh>
  );
}

/** Every half bond as one instanced rod. */
function Rods({ rods }: { readonly rods: Shape["rods"] }) {
  const tints = use(Tints);
  const { tier } = useStage();
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(
    () => new CylinderGeometry(1, 1, 1, facetsOf(tier).rod, 1, true),
    [tier]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const from = new Vector3();
    const along = new Vector3();
    const size = new Vector3();
    const color = new Color();
    Arr.forEach(rods, (rod, index) => {
      from.set(rod.from[0], rod.from[1], rod.from[2]);
      along.set(rod.to[0], rod.to[1], rod.to[2]).sub(from);
      const span = along.length();
      turn.setFromUnitVectors(UP, along.normalize());
      matrix.compose(
        from.addScaledVector(along, span / 2),
        turn,
        size.set(rod.radius, span, rod.radius)
      );
      target.setMatrixAt(index, matrix);
      target.setColorAt(index, color.set(colorOf(rod, tints)));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor !== null) {
      target.instanceColor.needsUpdate = true;
    }
    target.computeBoundingSphere();
  }, [rods, tints]);

  if (rods.length === 0) {
    return null;
  }
  return (
    <instancedMesh
      args={[geometry, undefined, rods.length]}
      castShadow
      key={rods.length}
      receiveShadow
      ref={mesh}
    >
      <SurfaceMaterial
        bump={0.3}
        coat={0.7}
        color={getColor("WHITE")}
        repeat={[1, 1]}
        roughness={0.45}
        surface="plastic"
      />
    </instancedMesh>
  );
}

/** One polymer backbone as a smooth tube with rounded ends. */
function Tube({
  color,
  points,
}: {
  readonly color: string;
  readonly points: readonly (readonly [number, number, number])[];
}) {
  const { tier } = useStage();
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(
      Arr.map(points, ([x, y, z]) => new Vector3(x, y, z)),
      false,
      "centripetal"
    );
    return new TubeGeometry(
      curve,
      points.length * 6,
      TUBE,
      facetsOf(tier).rod,
      false
    );
  }, [points, tier]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const ends = Arr.getSomes([Arr.head(points), Arr.last(points)]);

  return (
    <group>
      <mesh castShadow geometry={geometry} receiveShadow>
        <SurfaceMaterial
          bump={0.3}
          coat={0.7}
          color={color}
          repeat={[1, points.length]}
          roughness={0.4}
          surface="plastic"
        />
      </mesh>
      {Arr.map(ends, (end) => (
        <mesh
          castShadow
          key={Arr.join(Arr.map(end, String), ":")}
          position={end}
        >
          <sphereGeometry args={[TUBE, 16, 12]} />
          <SurfaceMaterial
            coat={0.7}
            color={color}
            roughness={0.4}
            surface="plastic"
          />
        </mesh>
      ))}
    </group>
  );
}
