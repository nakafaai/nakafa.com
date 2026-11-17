import { leafSurface } from "@repo/design-system/components/contents/biology/leaf";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { Array as Arr } from "effect";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  Float32BufferAttribute,
  type InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  SpotLight,
  Vector2,
  Vector3,
} from "three";

/** How long a rule's tick is at `mm` millimetres, as a share of the longest: full every centimetre, longer every half. */
function tickLength(mm: number) {
  if (mm % 10 === 0) {
    return 1;
  }
  return mm % 5 === 0 ? 0.7 : 0.45;
}

/** A point in a lab scene, in metres. */
type Point = readonly [number, number, number];

/** The world's up, along which a cylinder is built before it is turned. */
const UP = new Vector3(0, 1, 0);

/** Where a cylinder between two points stands, how it turns, and how long it is. */
function segment(start: Point, end: Point) {
  const from = new Vector3(...start);
  const to = new Vector3(...end);
  const direction = to.clone().sub(from);
  const length = direction.length();
  const quaternion = new Quaternion().setFromUnitVectors(
    UP,
    direction.normalize()
  );
  const middle = from.add(to).multiplyScalar(0.5);
  return { length, middle, quaternion };
}

/**
 * A straight run of glass tubing from `start` to `end`, its outer radius
 * `radius`, with the liquid inside it drawn in `liquid` when it is filled.
 */
export function GlassTube({
  end,
  liquid,
  opacity = 0.3,
  radius,
  start,
}: {
  readonly end: Point;
  readonly liquid?: string;
  readonly opacity?: number;
  readonly radius: number;
  readonly start: Point;
}) {
  const { length, middle, quaternion } = segment(start, end);
  return (
    <group position={middle} quaternion={quaternion}>
      <mesh>
        <cylinderGeometry args={[radius, radius, length, 28, 1, true]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={opacity} />
      </mesh>
      {liquid !== undefined && (
        <mesh>
          <cylinderGeometry
            args={[radius * 0.62, radius * 0.62, length, 20, 1]}
          />
          <LiquidMaterial color={liquid} opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

/** A solid rod between two points: a stem, a wire, or a clamp arm. */
function Rod({
  children,
  end,
  radius,
  start,
}: {
  readonly children: ReactNode;
  readonly end: Point;
  readonly radius: number;
  readonly start: Point;
}) {
  const { length, middle, quaternion } = segment(start, end);
  return (
    <mesh castShadow position={middle} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 16]} />
      {children}
    </mesh>
  );
}

/** A rubber bung `height` tall that seals a tube of inner radius `radius`, tapering towards its foot. */
export function Bung({
  height,
  radius,
}: {
  readonly height: number;
  readonly radius: number;
}) {
  return (
    <mesh castShadow>
      <cylinderGeometry args={[radius * 1.18, radius * 0.92, height, 32]} />
      <meshStandardMaterial color={BENCH_COLORS.stopper} roughness={0.85} />
    </mesh>
  );
}

/**
 * A retort stand whose clamp grips an upright tube of radius `grip`: a cast
 * base on the bench, a chrome rod behind the tube, and a boss and arm that
 * reach `reach` forward to two padded jaws at `height`.
 */
export function UprightClamp({
  grip,
  height,
  reach,
}: {
  readonly grip: number;
  readonly height: number;
  readonly reach: number;
}) {
  const rod = height + 0.1;
  return (
    <group position={[0, 0, -reach]}>
      <mesh castShadow position={[0, 0.006, 0.05]} receiveShadow>
        <boxGeometry args={[0.12, 0.012, 0.19]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.65} />
      </mesh>
      <mesh castShadow position={[0, rod / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, rod, 16]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
      <mesh castShadow position={[0, height, 0]}>
        <boxGeometry args={[0.026, 0.03, 0.026]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.5} />
      </mesh>
      <mesh
        castShadow
        position={[0, height, reach / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.005, 0.005, reach, 12]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[side * (grip + 0.004), height, reach]}
        >
          <boxGeometry args={[0.008, 0.022, 0.02]} />
          <meshStandardMaterial color={BENCH_COLORS.stopper} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A boxwood rule `length` long lying flat on its back with its zero at
 * `zero` (the left or the right end), engraved every millimetre, longer
 * every half centimetre, and numbered every `step` centimetres.
 */
export function FlatRule({
  length,
  step,
  zero,
}: {
  readonly length: number;
  readonly step: number;
  readonly zero: "left" | "right";
}) {
  const ticks = useRef<InstancedMesh>(null);
  const millimetres = Math.round(length * 1000);
  const along = (mm: number) =>
    zero === "left" ? -length / 2 + mm / 1000 : length / 2 - mm / 1000;

  useLayoutEffect(() => {
    const mesh = ticks.current;
    if (mesh === null) {
      return;
    }
    const matrix = new Matrix4();
    const scale = new Vector3();
    const place = new Vector3();
    const turn = new Quaternion();
    for (const mm of Arr.range(0, millimetres)) {
      const long = tickLength(mm);
      scale.set(1, 1, long);
      place.set(along(mm), 0.0021, -0.012 + (long * 0.013) / 2);
      mesh.setMatrixAt(mm, matrix.compose(place, turn, scale));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[length + 0.02, 0.004, 0.032]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.ruleWhite}
          roughness={0.75}
        />
      </mesh>
      <instancedMesh args={[undefined, undefined, millimetres + 1]} ref={ticks}>
        <boxGeometry args={[0.0006, 0.0002, 0.013]} />
        <meshBasicMaterial color={BIOLOGY_COLORS.ink} />
      </instancedMesh>
      {Arr.map(Arr.range(0, Math.floor((length * 100) / step)), (index) => (
        <ThreeLabel
          color={BIOLOGY_COLORS.ink}
          fontSize="compact"
          key={index}
          outlineColor={BIOLOGY_COLORS.ruleWhite}
          outlineWidth={0.02}
          position={[along(index * step * 10), 0.003, 0.008]}
        >
          {index * step}
        </ThreeLabel>
      ))}
    </group>
  );
}

/** How high a bench lamp's bulb stands above the bench, in metres. */
const LAMP_HEIGHT = 0.1;

/**
 * A bench lamp standing at the origin: a weighted base, an upright, and a
 * shade aimed along +x at `target`, its bulb lit. Its light falls off with
 * the square of the distance, as a real bulb's does.
 */
export function BenchLamp({ target }: { readonly target: Point }) {
  const aim = useMemo(() => {
    const object = new Object3D();
    object.position.set(...target);
    return object;
  }, [target]);
  // A bulb of about this many candela, its cone half-angle and soft edge;
  // the light falls off with the square of the distance (decay 2).
  const light = useMemo(() => {
    const spot = new SpotLight(CAR_COLORS.headlightGlow, 2.4, 0, 0.5, 0.7, 2);
    spot.target = aim;
    return spot;
  }, [aim]);
  useEffect(() => () => light.dispose(), [light]);
  const shade = useMemo(
    () => [
      new Vector2(0.012, -0.02),
      new Vector2(0.03, 0.025),
      new Vector2(0.031, 0.027),
    ],
    []
  );
  return (
    <group>
      <mesh castShadow position={[0, 0.006, 0]} receiveShadow>
        <cylinderGeometry args={[0.04, 0.045, 0.012, 40]} />
        <MetalMaterial color={ROAD_COLORS.lampPost} roughness={0.45} />
      </mesh>
      <mesh castShadow position={[-0.02, LAMP_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.004, 0.004, LAMP_HEIGHT, 12]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
      </mesh>
      <group position={[0, LAMP_HEIGHT, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh castShadow>
          <latheGeometry args={[shade, 40]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.lampShade}
            roughness={0.4}
            side={DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.006, 0]}>
          <sphereGeometry args={[0.012, 24, 16]} />
          <meshBasicMaterial
            color={CAR_COLORS.headlightGlow}
            toneMapped={false}
          />
        </mesh>
      </group>
      <primitive object={aim} />
      <primitive object={light} position={[0.01, LAMP_HEIGHT, 0]} />
    </group>
  );
}

/**
 * A small wooden stand: a plank `length` by `depth` whose top lies at
 * `height`, on four square legs, so glassware can rest on it above the bench.
 */
export function Trestle({
  depth,
  height,
  length,
}: {
  readonly depth: number;
  readonly height: number;
  readonly length: number;
}) {
  const legs = Arr.flatMap([-1, 1] as const, (x) =>
    Arr.map([-1, 1] as const, (z) => ({
      key: `${x}${z}`,
      position: [
        x * (length / 2 - 0.012),
        (height - 0.008) / 2,
        z * (depth / 2 - 0.01),
      ] as const,
    }))
  );
  return (
    <group>
      <mesh castShadow position={[0, height - 0.004, 0]} receiveShadow>
        <boxGeometry args={[length, 0.008, depth]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.blockWood}
          roughness={0.75}
        />
      </mesh>
      {Arr.map(legs, (leg) => (
        <mesh castShadow key={leg.key} position={leg.position}>
          <boxGeometry args={[0.012, height - 0.008, 0.012]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.blockWood}
            roughness={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A leafy shoot cut under water, standing up from its cut end at the
 * origin: a green stem with leaves set alternately up it. A leaf surface the
 * learner coated with petroleum jelly carries a glossy film.
 */
export function LeafyShoot({
  coatLower,
  coatUpper,
  height,
}: {
  readonly coatLower: boolean;
  readonly coatUpper: boolean;
  readonly height: number;
}) {
  const stem = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0.004, height * 0.45, 0.002),
        new Vector3(-0.006, height * 0.8, -0.002),
        new Vector3(-0.002, height, 0),
      ]),
    [height]
  );
  const blade = useMemo(() => {
    const surface = leafSurface({
      columns: 10,
      droop: 0.1,
      length: 1,
      rows: 18,
      width: 0.56,
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(surface.positions, 3)
    );
    geometry.setIndex(surface.indices);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => blade.dispose(), [blade]);
  // Each leaf: how far up the stem its petiole leaves it, how long it is,
  // how far it lifts, and which way round the stem it points.
  const leaves = Arr.map(Arr.range(0, 6), (index) => ({
    at: 0.3 + index * 0.1,
    length: 0.075 - index * 0.005,
    tilt: 0.12 + index * 0.05,
    turn: index * 2.4,
  }));

  return (
    <group>
      <mesh castShadow>
        <tubeGeometry args={[stem, 40, 0.0035, 10, false]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.stem} roughness={0.7} />
      </mesh>
      {Arr.map(leaves, (leaf) => (
        <group
          key={leaf.turn}
          position={stem.getPointAt(leaf.at).toArray()}
          rotation={[0, leaf.turn, leaf.tilt]}
        >
          <mesh
            castShadow
            geometry={blade}
            position={[0.012, 0, 0]}
            scale={leaf.length}
          >
            <meshPhysicalMaterial
              color={BIOLOGY_COLORS.leaf}
              roughness={0.55}
              side={DoubleSide}
            />
          </mesh>
          <Rod end={[0.013, 0, 0]} radius={0.0012} start={[0, 0, 0]}>
            <meshStandardMaterial color={BIOLOGY_COLORS.stem} roughness={0.7} />
          </Rod>
          {coatUpper && <Jelly blade={blade} length={leaf.length} side={1} />}
          {coatLower && <Jelly blade={blade} length={leaf.length} side={-1} />}
        </group>
      ))}
    </group>
  );
}

/** The film of petroleum jelly on one surface of a leaf: `side` 1 above, -1 below. */
function Jelly({
  blade,
  length,
  side,
}: {
  readonly blade: BufferGeometry;
  readonly length: number;
  readonly side: 1 | -1;
}) {
  return (
    <mesh
      geometry={blade}
      position={[0.012, side * 0.0007, 0]}
      scale={[length * 0.98, length, length * 0.96]}
    >
      <meshPhysicalMaterial
        clearcoat={1}
        clearcoatRoughness={0.05}
        color={BIOLOGY_COLORS.jelly}
        depthWrite={false}
        opacity={0.55}
        roughness={0.1}
        side={DoubleSide}
        transparent
      />
    </mesh>
  );
}
