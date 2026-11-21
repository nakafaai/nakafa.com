import { useFrame } from "@react-three/fiber";
import {
  CAPILLARIES,
  CENTRES,
  FRONT,
  LENGTH,
  LUMEN,
  MICRONS,
  WALL,
} from "@repo/design-system/components/contents/biology/muscle/bundle";
import { CAPILLARY } from "@repo/design-system/components/contents/biology/muscle/debt";
import { usePose } from "@repo/design-system/components/contents/biology/muscle/pose";
import { useClipping } from "@repo/design-system/components/contents/biology/surface";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { MUSCLE_COLORS } from "@repo/design-system/lib/material/muscle";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { InstancedMesh, Mesh } from "three";
import {
  Color,
  DoubleSide,
  LatheGeometry,
  MeshPhysicalMaterial,
  Object3D,
  Plane,
  Vector2,
  Vector3,
} from "three";

/**
 * A human red blood cell's biconcave profile (Evans & Fung 1972, Microvasc Res
 * 4:335): radius 3.91 µm, and thickness
 * √(1 − x²)(0.81 + 7.83x² − 4.39x⁴) µm at x of the way to the rim, which is
 * 0.81 µm in the middle and 2.58 µm at its thickest. OpenStax Anatomy and
 * Physiology 2e, 18.3, gives a mean diameter of about 7 to 8 µm.
 */
const CELL = { c0: 0.81, c2: 7.83, c4: -4.39, radius: 3.91 } as const;

/**
 * How a red cell folds to pass a capillary of the lab's 8 µm lumen: its rim
 * drawn in a little and swept back into a shallow cup, the parachute shape
 * red cells take in capillaries no wider than themselves.
 */
const FOLD = { cup: 0.9, squeeze: 0.88 } as const;

/** Red cells a micrometre of capillary holds at their closest, after contractions. */
const CROWDED = CAPILLARY.work.flux / CAPILLARY.work.speed;

/**
 * How much of each capillary its red cells are drawn along, in scene units:
 * the whole length of an open groove, and only the front of a capillary
 * buried between three fibres, where the cut shows it.
 */
const RUNS = { buried: 4, open: LENGTH } as const;

/** The length of the capillary at `index` drawn with cells: open grooves have odd indices. */
function runOf(index: number) {
  return index % 2 === 1 ? RUNS.open : RUNS.buried;
}

/** How many places for red cells the capillary at `index` keeps, at their closest spacing. */
function seatsOf(index: number) {
  return Math.ceil(runOf(index) * MICRONS * CROWDED);
}

/** Each capillary's cross-section, index, the length of it drawn with cells, and where its cells' places start. */
const VESSELS = Arr.map(CAPILLARIES, (point, index) => ({
  first: Arr.reduce(
    Arr.take(CAPILLARIES, index),
    0,
    (sum, _, earlier) => sum + seatsOf(earlier)
  ),
  index,
  point,
  run: runOf(index),
  seats: seatsOf(index),
}));

/** How many red cells the scene keeps in all. */
const SEATS = Arr.reduce(VESSELS, 0, (sum, vessel) => sum + vessel.seats);

/** The grooves between outer fibres, whose capillaries lie open to view. */
const GROOVES = Arr.filter(VESSELS, ({ index }) => index % 2 === 1);

/** Builds a red cell's folded biconcave shape as a solid of revolution about x. */
function useCellGeometry() {
  const geometry = useMemo(() => {
    const steps = 14;
    const rim = Arr.map(Arr.range(0, steps), (step) =>
      Math.sin((Math.PI / 2) * (step / steps))
    );
    const half = (x: number) =>
      (Math.sqrt(Math.max(0, 1 - x * x)) *
        (CELL.c0 + CELL.c2 * x * x + CELL.c4 * x ** 4)) /
      2;
    const point = (x: number, side: number) =>
      new Vector2(
        (x * CELL.radius * FOLD.squeeze) / MICRONS,
        (side * half(x) + FOLD.cup * x * x) / MICRONS
      );
    const profile = [
      ...Arr.map(rim, (x) => point(x, -1)),
      ...Arr.map(Arr.reverse(Arr.dropRight(rim, 1)), (x) => point(x, 1)),
    ];
    const lathe = new LatheGeometry(profile, 18);
    lathe.rotateZ(-Math.PI / 2);
    lathe.computeVertexNormals();
    return lathe;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * The capillaries between the fibres: thin, glassy walls of endothelium along
 * the fascicle, cut at both ends with it, lengthening and shortening with the
 * fibres and riding outward as they swell.
 */
export function Capillaries() {
  const pose = usePose();
  const tubes = useRef<(Mesh | null)[]>([]);

  useFrame(() => {
    const now = pose.current;
    Arr.forEach(VESSELS, ({ index, point }) => {
      const tube = tubes.current[index];
      tube?.position.set(now.shift, point[0] * now.swell, point[1] * now.swell);
      tube?.scale.set(1, now.stretch, 1);
    });
  });

  return Arr.map(VESSELS, ({ index, point }) => (
    <mesh
      key={index}
      position={[0, point[0], point[1]]}
      ref={(tube) => {
        tubes.current[index] = tube;
      }}
      rotation={[0, 0, Math.PI / 2]}
    >
      <cylinderGeometry
        args={[LUMEN + WALL / 2, LUMEN + WALL / 2, LENGTH, 28, 1, true]}
      />
      <meshPhysicalMaterial
        clearcoat={0.8}
        clearcoatRoughness={0.18}
        color={MUSCLE_COLORS.endothelium}
        depthWrite={false}
        opacity={0.34}
        roughness={0.3}
        side={DoubleSide}
        transparent
      />
    </mesh>
  ));
}

/**
 * The red blood cells, flowing through every capillary from the front of the
 * fascicle, its arterial end, towards the back, its venous end, at the speed
 * and spacing the pose sets. Each darkens as it gives up its oxygen, more so
 * the harder the muscle works. Cells are cut where the fascicle is cut.
 */
export function Cells() {
  useClipping();
  const pose = usePose();
  const cells = useRef<InstancedMesh>(null);
  const geometry = useCellGeometry();
  const planes = useMemo(
    () => [
      new Plane(new Vector3(-1, 0, 0), FRONT),
      new Plane(new Vector3(1, 0, 0), FRONT),
    ],
    []
  );
  const material = useMemo(
    () =>
      // Clipping planes are set on the material object, which JSX props cannot name.
      new MeshPhysicalMaterial({
        clearcoat: 0.55,
        clearcoatRoughness: 0.3,
        clippingPlanes: planes,
        roughness: 0.38,
        sheen: 0.4,
        sheenColor: new Color(MUSCLE_COLORS.oxygenated),
        side: DoubleSide,
      }),
    [planes]
  );
  useEffect(() => () => material.dispose(), [material]);
  const holder = useMemo(() => new Object3D(), []);
  const fresh = useMemo(() => new Color(MUSCLE_COLORS.oxygenated), []);
  const spent = useMemo(() => new Color(MUSCLE_COLORS.reduced), []);
  const tint = useMemo(() => new Color(), []);
  const spacing = 1 / (CROWDED * MICRONS);

  useFrame(() => {
    const mesh = cells.current;
    if (mesh === null) {
      return;
    }
    const now = pose.current;
    const [front, back] = planes;
    front?.set(front.normal, FRONT);
    back?.set(back.normal, FRONT * now.stretch - now.shift);
    const extraction = 0.35 + 0.55 * now.share;
    Arr.forEach(VESSELS, ({ first, index, point, run, seats }) => {
      Arr.forEach(Arr.range(0, seats - 1), (seat) => {
        const slot = first + seat;
        const travel =
          (seat * spacing + now.carried + hashUnit(index, 5) * run) % run;
        const shown = hashUnit(index, seat + 40) < now.crowd;
        holder.position.set(
          (FRONT - travel) * now.stretch + now.shift,
          point[0] * now.swell,
          point[1] * now.swell
        );
        holder.rotation.set(hashUnit(seat, index + 3) * Math.PI * 2, 0, 0);
        holder.scale.setScalar(shown ? 1 : 0);
        holder.updateMatrix();
        mesh.setMatrixAt(slot, holder.matrix);
        tint.copy(fresh).lerp(spent, (travel / LENGTH) * extraction);
        mesh.setColorAt(slot, tint);
      });
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      args={[geometry, material, SEATS]}
      castShadow
      frustumCulled={false}
      ref={cells}
    />
  );
}

/** How many oxygen dots each capillary sends across the front cut, and along each open groove. */
const OXYGEN = { face: 6, groove: 10 } as const;

/**
 * How long an oxygen dot takes to leave its capillary and vanish into a
 * fibre, in seconds of play. It is a pace to watch, like the slowed blood:
 * oxygen crosses these few tens of micrometres in well under a second.
 */
const DIFFUSION = 2.4;

/** The fibre centres next to the capillary at `index`: three round a corner, two beside a groove. */
function neighbours(index: number) {
  const ring = Math.floor(index / 2);
  const around = [1 + ring, 1 + ((ring + 1) % 6)];
  return index % 2 === 0 ? [0, ...around] : around;
}

/**
 * Oxygen leaving the red cells: blue dots that cross the capillary wall and
 * fade into the fibres beside it, on the front cut and along the open
 * grooves, more of them the more oxygen the muscle takes up.
 */
export function Oxygen() {
  const pose = usePose();
  const dots = useRef<InstancedMesh>(null);
  const holder = useMemo(() => new Object3D(), []);
  const paths = useMemo(
    () => [
      ...Arr.flatMap(VESSELS, ({ index, point }) =>
        Arr.map(Arr.range(0, OXYGEN.face - 1), (slot) => {
          const choices = neighbours(index);
          const target = CENTRES[choices[slot % choices.length] ?? 0] ?? [0, 0];
          const toward = Math.atan2(target[1] - point[1], target[0] - point[0]);
          const spread = (hashUnit(index, slot + 70) - 0.5) * 0.9;
          const far = 0.7 + 1.1 * hashUnit(slot, index + 90);
          return {
            along: FRONT + 0.012,
            angle: toward + spread,
            far,
            near: LUMEN * 0.4,
            point,
            seed: hashUnit(index * 31 + slot, 11),
          };
        })
      ),
      ...Arr.flatMap(GROOVES, ({ index, point }) =>
        Arr.map(Arr.range(0, OXYGEN.groove - 1), (slot) => {
          const choices = neighbours(index);
          const target = CENTRES[choices[slot % 2] ?? 0] ?? [0, 0];
          return {
            along: -FRONT + 1 + (LENGTH - 2) * hashUnit(index, slot + 120),
            angle:
              Math.atan2(target[1] - point[1], target[0] - point[0]) +
              (hashUnit(slot, index) - 0.5) * 0.6,
            far: LUMEN + WALL + 0.25,
            near: LUMEN * 0.5,
            point,
            seed: hashUnit(index * 17 + slot, 29),
          };
        })
      ),
    ],
    []
  );

  useFrame(() => {
    const mesh = dots.current;
    if (mesh === null) {
      return;
    }
    const now = pose.current;
    Arr.forEach(paths, (path, slot) => {
      const run = (now.seconds / DIFFUSION + path.seed) % 1;
      const reach = path.near + (path.far - path.near) * run;
      const shown = path.seed < now.oxygen;
      holder.position.set(
        path.along * now.stretch + now.shift,
        (path.point[0] + Math.cos(path.angle) * reach) * now.swell,
        (path.point[1] + Math.sin(path.angle) * reach) * now.swell
      );
      holder.scale.setScalar(shown ? 0.055 * Math.sin(Math.PI * run) : 0);
      holder.updateMatrix();
      mesh.setMatrixAt(slot, holder.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[undefined, undefined, paths.length]}
      frustumCulled={false}
      ref={dots}
    >
      <sphereGeometry args={[1, 12, 8]} />
      <meshStandardMaterial
        color={MUSCLE_COLORS.oxygen}
        emissive={MUSCLE_COLORS.oxygen}
        emissiveIntensity={0.55}
        roughness={0.35}
      />
    </instancedMesh>
  );
}
