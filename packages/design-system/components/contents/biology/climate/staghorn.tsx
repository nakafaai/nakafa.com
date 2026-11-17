import {
  type Colony,
  CoralliteMaterial,
  TissueMaterial,
  useTissuePaint,
} from "@repo/design-system/components/contents/biology/climate/coral";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { useBumpySphere } from "@repo/design-system/components/contents/biology/surface";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr, Option } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  type BufferGeometry,
  CatmullRomCurve3,
  MathUtils,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const UP = new Vector3(0, 1, 0);
const ACROSS = new Vector3(1, 0, 0);

/** Steps along a branch's centre line, and samples along it for the fit test. */
const STEPS = 6;
const SAMPLES = 16;

/** Sides around a branch, and tube rings per metre of branch. */
const RADIAL = 12;
const RINGS_PER_METRE = 320;

/** The clear space every branch keeps from every other branch and coral, in metres. */
const GAP = 0.004;

/** How thin a branch grows toward its tip, as a share of its base. */
const TAPER = 0.66;

/** The trunks a colony starts with, and the turns a branch tries before it gives up. */
const TRUNKS = 6;
const TURNS = [0, 1.1, -1.1, 2.2, -2.2] as const;

/** The fewest side branches off a trunk, a first and a second side branch; a trunk or a first side branch may grow one more. */
const FORKS = [2, 1, 1] as const;

/** The radial corallites: one every 3.4 mm, turning by the golden angle. */
const SPACING = 0.0034;
const GOLDEN = 2.399_96;

/**
 * A radial corallite as Acropora cervicornis grows it: a short tube 2.5 mm
 * long that leans toward the tip, open at its lip. Its foot sinks into the
 * branch it stands on.
 */
const CORALLITE = Arr.map(
  [
    [0.0011, -0.0008],
    [0.0011, 0.0011],
    [0.000_95, 0.0021],
    [0.0007, 0.0025],
    [0.000_45, 0.0021],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/**
 * The lump of old reef rock a colony grows from, half sunk in the sand: its
 * radius and stretch, how far its middle sits below the sand, and the
 * height under which its top hides the branches.
 */
const ROCK = {
  radius: 0.028,
  scale: [1.2, 0.8, 1.05],
  sink: -0.008,
  top: 0.02,
} as const;

/**
 * A branch about to grow: where it starts and heads, the axis it may turn
 * about to find room, its length and base radius, its depth in the colony,
 * and how far along it hides inside its parent.
 */
function specOf(
  start: Vector3,
  heading: Vector3,
  axis: Vector3,
  length: number,
  radius: number,
  depth: number,
  skip: number
) {
  return { axis, depth, heading, length, radius, skip, start };
}
type Spec = ReturnType<typeof specOf>;

/** A direction square to `tangent`, `angle` radians round it. */
function perpendicular(tangent: Vector3, angle: number) {
  const reference = Math.abs(tangent.y) < 0.95 ? UP : ACROSS;
  const normal = new Vector3().crossVectors(tangent, reference).normalize();
  const binormal = new Vector3().crossVectors(tangent, normal);
  return normal
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(binormal, Math.sin(angle));
}

/**
 * A grown branch: its centre line, which bends a little more toward the
 * light at every step and wanders slightly, and its samples for the fit test.
 */
function branchOf(spec: Spec, seed: number) {
  const step = spec.length / STEPS;
  const points = Arr.scan(
    Arr.range(0, STEPS - 1),
    spec.start,
    (point, index) => {
      const wander = new Vector3(
        hashUnit(seed, index) - 0.5,
        0,
        hashUnit(seed + 1, index) - 0.5
      ).multiplyScalar(0.22);
      const direction = spec.heading
        .clone()
        .lerp(UP, 0.04 * (index + 1))
        .add(wander)
        .normalize();
      return point.clone().addScaledVector(direction, step);
    }
  );
  const curve = new CatmullRomCurve3(points);
  const tip = spec.radius * TAPER;
  const samples = Arr.map(Arr.range(0, SAMPLES), (index) => ({
    point: curve.getPointAt(index / SAMPLES),
    radius: MathUtils.lerp(spec.radius, tip, index / SAMPLES),
  }));
  return { curve, length: curve.getLength(), samples, spec, tip };
}
type Branch = ReturnType<typeof branchOf>;

/** Whether `branch` keeps clear of every branch already grown, every obstacle, and the colony's reach. */
function fits(
  branch: Branch,
  placed: readonly Branch[],
  obstacles: readonly (readonly [number, number, number, number])[],
  reach: number
) {
  const free = Arr.filter(
    branch.samples,
    (sample) => sample.point.distanceTo(branch.spec.start) > branch.spec.skip
  );
  return Arr.every(
    free,
    (sample) =>
      Math.hypot(sample.point.x, sample.point.z) <= reach &&
      Arr.every(placed, (other) =>
        Arr.every(
          other.samples,
          (near) =>
            sample.point.distanceTo(near.point) >=
            sample.radius + near.radius + GAP
        )
      ) &&
      Arr.every(
        obstacles,
        ([x, y, z, radius]) =>
          sample.point.distanceTo(new Vector3(x, y, z)) >=
          sample.radius + radius + GAP
      )
  );
}

/**
 * The side branches of `branch`: two or three off a trunk, one or two off a
 * first side branch and one off a second, each leaving at 30 to 50 degrees
 * and shorter than its parent, as staghorn branches fork. A side branch
 * hides inside its parent until it has left the parent's surface.
 */
function childrenOf(branch: Branch, seed: number): readonly Spec[] {
  const { depth } = branch.spec;
  if (depth >= 3) {
    return [];
  }
  const count =
    (FORKS[depth] ?? 0) + (depth < 2 ? Math.round(hashUnit(seed, 9)) : 0);
  return Arr.map(Arr.range(0, count - 1), (index) => {
    const t = 0.3 + (0.45 * (index + hashUnit(seed, index + 20))) / count;
    const point = branch.curve.getPointAt(t);
    const tangent = branch.curve.getTangentAt(t);
    const side = perpendicular(
      tangent,
      hashUnit(seed, index + 40) * Math.PI * 2
    );
    const angle = 0.52 + hashUnit(seed, index + 60) * 0.35;
    const parent = MathUtils.lerp(branch.spec.radius, branch.tip, t);
    const radius = parent * 0.84;
    return specOf(
      point,
      tangent
        .clone()
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(side, Math.sin(angle)),
      tangent,
      branch.length *
        (0.48 + hashUnit(seed, index + 80) * 0.25) *
        (1 - t * 0.35),
      radius,
      depth + 1,
      (parent + radius + GAP) / Math.sin(angle) + 0.003
    );
  });
}

/**
 * Grows `spec` and then its side branches onto `placed`, turning each about
 * its axis until it finds room; one that finds none is left out, with its
 * side branches.
 */
function grow(
  placed: readonly Branch[],
  spec: Spec,
  seed: number,
  obstacles: readonly (readonly [number, number, number, number])[],
  reach: number
): readonly Branch[] {
  const turned = (turn: number) =>
    branchOf(
      {
        ...spec,
        heading: spec.heading.clone().applyAxisAngle(spec.axis, turn),
      },
      seed
    );
  return Option.match(
    Arr.findFirst(TURNS, (turn) => {
      const branch = turned(turn);
      return fits(branch, placed, obstacles, reach)
        ? Option.some(branch)
        : Option.none();
    }),
    {
      onNone: () => placed,
      onSome: (branch) => {
        const grown: readonly Branch[] = Arr.append(placed, branch);
        return Arr.reduce(
          childrenOf(branch, seed + 13),
          grown,
          (more, child, index) =>
            grow(more, child, seed * 7 + index + 31, obstacles, reach)
        );
      },
    }
  );
}

/** The branches of colony `seed`: six trunks rising from the rock at seeded leans, and their forks. */
function colonyOf(
  seed: number,
  obstacles: readonly (readonly [number, number, number, number])[],
  reach: number
) {
  const trunks = Arr.map(Arr.range(0, TRUNKS - 1), (index) => {
    const azimuth =
      (index / TRUNKS) * Math.PI * 2 + (hashUnit(seed, index) - 0.5) * 0.7;
    const lean = 0.4 + hashUnit(seed + 2, index) * 0.45;
    return specOf(
      new Vector3(Math.cos(azimuth) * 0.014, 0.004, Math.sin(azimuth) * 0.014),
      new Vector3(
        Math.sin(lean) * Math.cos(azimuth),
        Math.cos(lean),
        Math.sin(lean) * Math.sin(azimuth)
      ),
      UP,
      0.09 + hashUnit(seed + 5, index) * 0.04,
      0.0048,
      0,
      0.024
    );
  });
  const none: readonly Branch[] = [];
  return Arr.reduce(trunks, none, (placed, trunk, index) =>
    grow(placed, trunk, seed * 31 + index, obstacles, reach)
  );
}

/**
 * One branch as a tapered tube with a rounded growing tip. Its `tipness`
 * rises over the last 16 mm to the axial corallite, and its `shade` darkens
 * low in the colony, where the branches above cut the light.
 */
function branchGeometry(branch: Branch) {
  const rings = Math.max(8, Math.round(branch.length * RINGS_PER_METRE));
  const tube = new TubeGeometry(branch.curve, rings, 1, RADIAL, false);
  const position = tube.getAttribute("position");
  const tipness = new Float32Array(position.count);
  const shade = new Float32Array(position.count);
  const centre = new Vector3();
  const vertex = new Vector3();
  for (const ring of Arr.range(0, rings)) {
    const t = ring / rings;
    branch.curve.getPointAt(t, centre);
    const radius = MathUtils.lerp(branch.spec.radius, branch.tip, t);
    const tip = MathUtils.smoothstep(
      t * branch.length,
      branch.length - 0.016,
      branch.length - 0.002
    );
    const dark = 0.6 + 0.4 * MathUtils.smoothstep(centre.y, 0.01, 0.12);
    for (const side of Arr.range(0, RADIAL)) {
      const index = ring * (RADIAL + 1) + side;
      vertex
        .fromBufferAttribute(position, index)
        .sub(centre)
        .multiplyScalar(radius)
        .add(centre);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
      tipness[index] = tip;
      shade[index] = dark;
    }
  }
  tube.setAttribute("tipness", new BufferAttribute(tipness, 1));
  tube.setAttribute("shade", new BufferAttribute(shade, 1));

  const end = branch.curve.getPointAt(1);
  const cap = new SphereGeometry(
    branch.tip,
    RADIAL,
    5,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  cap.scale(1, 1.3, 1);
  cap.applyQuaternion(
    new Quaternion().setFromUnitVectors(UP, branch.curve.getTangentAt(1))
  );
  cap.translate(end.x, end.y, end.z);
  const count = cap.getAttribute("position").count;
  cap.setAttribute(
    "tipness",
    new BufferAttribute(new Float32Array(Arr.replicate(1, count)), 1)
  );
  cap.setAttribute(
    "shade",
    new BufferAttribute(new Float32Array(Arr.replicate(1, count)), 1)
  );
  return [tube, cap];
}

/**
 * The radial corallites along every branch, one every 3.4 mm round the
 * golden angle, each leaning toward the tip and smaller near it, where new
 * ones are still growing. None stands inside the rock.
 */
function corallitesOf(branches: readonly Branch[], seed: number) {
  const all = Arr.flatMap(branches, (branch, number) => {
    const first = branch.spec.skip * 0.6;
    const count = Math.floor((branch.length - first - 0.004) / SPACING);
    if (count < 1) {
      return [];
    }
    return Arr.map(Arr.range(0, count - 1), (index) => {
      const along =
        first + index * SPACING + hashUnit(seed + number, index) * 0.0012;
      const t = along / branch.length;
      const point = branch.curve.getPointAt(t);
      const tangent = branch.curve.getTangentAt(t);
      const radius = MathUtils.lerp(branch.spec.radius, branch.tip, t);
      const side = perpendicular(
        tangent,
        index * GOLDEN + hashUnit(number, index + seed) * 0.6
      );
      const size =
        (radius / 0.004) *
        (0.8 + 0.4 * hashUnit(index, number + seed)) *
        (1 -
          0.55 *
            MathUtils.smoothstep(along, branch.length - 0.02, branch.length));
      const foot = point.clone().addScaledVector(side, radius * 0.85);
      const lean = side.multiplyScalar(0.75).addScaledVector(tangent, 0.66);
      return {
        position: [foot.x, foot.y, foot.z] as const,
        scale: [size, size, size] as const,
        up: [lean.x, lean.y, lean.z] as const,
      };
    });
  });
  return Arr.filter(all, (placement) => placement.position[1] > ROCK.top);
}

/** The lump of reef rock a colony grows from, half sunk in the sand. */
function Rock({ seed }: { readonly seed: number }) {
  const geometry = useBumpySphere(ROCK.radius, seed, 0.45);
  return (
    <mesh
      castShadow
      geometry={geometry}
      position={[0, ROCK.sink, 0]}
      receiveShadow
      scale={ROCK.scale}
    >
      <meshStandardMaterial color={ECOLOGY_COLORS.reefRock} roughness={0.95} />
    </mesh>
  );
}

/**
 * A staghorn coral, Acropora cervicornis, as a reef tank grows it: tapered
 * branches that curve up toward the light and fork, covered in radial
 * corallites, each ending in a paler growing tip, rising from a lump of rock
 * in the sand. Branches that would touch another branch, another coral or
 * the glass turn aside or are left out, so nothing passes through anything.
 * `obstacles` are spheres `[x, y, z, radius]` in the colony's own frame.
 */
export function StaghornCoral({
  colony,
  obstacles,
  position,
  reach,
  seed,
}: {
  readonly colony: Colony;
  readonly obstacles: readonly (readonly [number, number, number, number])[];
  readonly position: readonly [number, number, number];
  readonly reach: number;
  readonly seed: number;
}) {
  const { corallites, geometry } = useMemo(() => {
    const branches = colonyOf(seed, obstacles, reach);
    const parts: readonly BufferGeometry[] = Arr.flatMap(
      branches,
      branchGeometry
    );
    return {
      corallites: corallitesOf(branches, seed),
      geometry: mergeGeometries([...parts]),
    };
  }, [obstacles, reach, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useTissuePaint(geometry, colony);

  return (
    <group position={position}>
      <Rock seed={seed} />
      <mesh castShadow geometry={geometry} receiveShadow>
        <TissueMaterial />
      </mesh>
      <Instances placements={corallites}>
        <latheGeometry args={[CORALLITE, 7]} />
        <CoralliteMaterial colony={colony} />
      </Instances>
    </group>
  );
}
